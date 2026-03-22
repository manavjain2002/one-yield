import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  api,
  setAuthToken,
  loadStoredToken,
  isApiConfigured,
  getErrorMessage,
  AUTH_TOKEN_REFRESHED_EVENT,
} from '@/lib/api';
import { useAccount, useDisconnect, useBalance, useSignMessage, useChainId, useSwitchChain } from 'wagmi';
import { wagmiTargetChain } from '@/lib/wagmi-target-chain';
import { useConnectModal } from '@rainbow-me/rainbowkit';

export type WalletKind = 'metamask' | 'walletconnect';

export type UserRole = 'borrower' | 'lender' | 'manager' | 'admin';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  username: string | null;
  role: UserRole | null;
  balance: number;
  network: 'mainnet' | 'testnet';
  accessToken: string | null;
  walletType: WalletKind | null;
  needsReAuth: boolean;
  /** From JWT: first-time Web3 signup must pick Lender vs Pool Manager before using the app. */
  needsRoleSelection: boolean;
  /**
   * After credential logout while wallet stays connected: do not auto-run Web3 verify
   * or show the "Verifying identity" full-screen gate on the landing page.
   */
  blockWeb3AutoVerify: boolean;
}

interface WalletContextType extends WalletState {
  /** True after the first sync from localStorage (avoid ProtectedRoute redirect before JWT hydrate). */
  authHydrated: boolean;
  connect: () => Promise<void>;
  /** Clears JWT and app session; keeps browser wallet connected (borrower/admin logout). */
  logoutSession: () => void;
  /** Clears session and disconnects the browser wallet (lender/manager / full reset). */
  disconnect: () => void;
  selectRole: (role: UserRole) => Promise<void>;
  loginUser: (
    username: string,
    passwordPlain: string,
  ) => Promise<{ accessToken: string; role: UserRole; username: string }>;
  registerUser: (
    username: string,
    passwordPlain: string,
    role: UserRole,
    profile: { displayName: string; email: string; country: string },
  ) => Promise<{ accessToken: string; role: UserRole; username: string }>;
  setNeedsReAuth: (v: boolean) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

function decodeJwtPayload(token: string): {
  walletAddress?: string;
  username?: string;
  role?: UserRole;
  needsRoleSelection?: boolean;
} | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = JSON.parse(atob(b64 + pad)) as {
      walletAddress?: string;
      role?: UserRole;
      username?: string;
      needsRoleSelection?: boolean;
    };
    return json;
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { data: balanceData } = useBalance({ address: wagmiAddress });
  const { signMessageAsync } = useSignMessage();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const web3LoginInFlight = useRef(false);

  const [authHydrated, setAuthHydrated] = useState(false);

  const emptyWalletState = (): WalletState => ({
    isConnected: false,
    address: null,
    username: null,
    role: null,
    balance: 0,
    network: import.meta.env.VITE_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
    accessToken: null,
    walletType: null,
    needsReAuth: false,
    needsRoleSelection: false,
    blockWeb3AutoVerify: false,
  });

  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    username: null,
    role: null,
    balance: 0,
    network: import.meta.env.VITE_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
    accessToken: null,
    walletType: null,
    needsReAuth: false,
    needsRoleSelection: false,
    blockWeb3AutoVerify: false,
  });

  const applyTokenFromStorage = useCallback((accessToken: string) => {
    const payload = decodeJwtPayload(accessToken);
    if (!payload) return;
    setAuthToken(accessToken);
    setState((prev) => ({
      ...prev,
      accessToken,
      address:
        payload.walletAddress != null && payload.walletAddress !== ''
          ? payload.walletAddress
          : prev.address,
      username: payload.username != null ? payload.username : prev.username,
      role: payload.role ?? prev.role,
      isConnected: true,
      needsRoleSelection: payload.needsRoleSelection === true,
      blockWeb3AutoVerify: false,
    }));
  }, []);

  // Load stored token on mount
  useEffect(() => {
    const t = loadStoredToken();
    if (t) {
      const payload = decodeJwtPayload(t);
      if (payload) {
        setAuthToken(t);
        setState((prev) => ({
          ...prev,
          accessToken: t,
          address: payload.walletAddress || null, // Strictly follow payload
          username: payload.username || null,
          role: payload.role || null,
          isConnected: true,
          needsRoleSelection: payload.needsRoleSelection === true,
          blockWeb3AutoVerify: false,
        }));
      } else {
        setAuthToken(null);
      }
    }
    setAuthHydrated(true);
  }, []);

  const disconnect = useCallback(() => {
    setAuthToken(null);
    try {
      wagmiDisconnect();
    } catch (e) {
      console.warn('[WalletContext] Web3 disconnect warning:', e);
    }
    setState(emptyWalletState());
  }, [wagmiDisconnect]);

  const logoutSession = useCallback(() => {
    setAuthToken(null);
    setState((prev) => ({
      ...emptyWalletState(),
      isConnected: Boolean(wagmiIsConnected && wagmiAddress),
      address: wagmiAddress ?? null,
      balance: balanceData != null ? Number(balanceData.formatted) : 0,
      network: prev.network,
      blockWeb3AutoVerify: true,
    }));
  }, [wagmiIsConnected, wagmiAddress, balanceData]);

  // Sync state with wagmi (balance + address when connected)
  useEffect(() => {
    if (wagmiIsConnected && wagmiAddress) {
      setState((prev) => ({
        ...prev,
        isConnected: true,
        address: wagmiAddress,
        balance: balanceData ? Number(balanceData.formatted) : prev.balance,
      }));
    } else if (
      !wagmiIsConnected &&
      state.accessToken &&
      (state.role === 'lender' || state.role === 'manager') &&
      !state.username
    ) {
      console.log('[WalletContext] Web3 disconnected - logging out wallet session');
      disconnect();
    }
  }, [wagmiIsConnected, wagmiAddress, balanceData, state.accessToken, state.role, state.username, disconnect]);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, blockWeb3AutoVerify: false }));
    const useMock = import.meta.env.VITE_USE_MOCK_WALLET === 'true' || !isApiConfigured();

    if (useMock) {
      setState((prev) => ({
        ...prev,
        isConnected: true,
        address: '0x0000000000000000000000000000000000000001',
        walletType: 'metamask',
        balance: 12450.75,
        blockWeb3AutoVerify: false,
      }));
      toast.success('Connected (mock wallet)');
      return;
    }

    if (openConnectModal) {
      openConnectModal();
    } else {
      console.warn('[WalletContext] Connect modal not available');
    }
  }, [openConnectModal]);

  const loginWeb3 = useCallback(async (walletAddress: string) => {
    if (web3LoginInFlight.current) return;
    web3LoginInFlight.current = true;
    try {
      if (chainId !== wagmiTargetChain.id) {
        try {
          if (!switchChainAsync) {
            console.warn(
              `[WalletContext] Cannot auto-switch chain; use ${wagmiTargetChain.name} (chain ${wagmiTargetChain.id}).`,
            );
            return;
          }
          await switchChainAsync({ chainId: wagmiTargetChain.id });
        } catch (e) {
          console.error('[WalletContext] Network switch failed:', e);
          return;
        }
      }

      try {
        // 1. Get challenge
        const { data: challenge } = await api.post<{ challengeId: string; message: string }>(
          '/auth/challenge',
          { walletAddress }
        );

        // 2. Sign message
        const signatureHex = await signMessageAsync({ 
          account: walletAddress as `0x${string}`,
          message: challenge.message 
        });

        // 3. Verify and login
        const { data: auth } = await api.post<{
          accessToken: string;
          role: UserRole;
          walletAddress: string;
        }>('/auth/verify', {
          walletAddress,
          challengeId: challenge.challengeId,
          signatureHex,
        });

        setAuthToken(auth.accessToken);
        const decoded = decodeJwtPayload(auth.accessToken);
        setState((prev) => ({
          ...prev,
          isConnected: true,
          address: auth.walletAddress,
          accessToken: auth.accessToken,
          role: auth.role,
          needsReAuth: false,
          needsRoleSelection: decoded?.needsRoleSelection === true,
          blockWeb3AutoVerify: false,
        }));
        
        toast.success('Web3 identity verified');
      } catch (e) {
        console.error('[WalletContext] Web3 login failed:', e);
        // If login fails, we might want to disconnect to avoid being stuck in a half-connected state
        disconnect();
      }
    } finally {
      web3LoginInFlight.current = false;
    }
  }, [chainId, switchChainAsync, signMessageAsync, disconnect]);

  // Silent JWT refresh keeps localStorage in sync with React auth state
  useEffect(() => {
    const onTokenRefreshed = (e: Event) => {
      const t = (e as CustomEvent<{ accessToken: string }>).detail?.accessToken;
      if (typeof t === 'string' && t.length > 0) {
        applyTokenFromStorage(t);
      }
    };
    window.addEventListener(AUTH_TOKEN_REFRESHED_EVENT, onTokenRefreshed);
    return () => window.removeEventListener(AUTH_TOKEN_REFRESHED_EVENT, onTokenRefreshed);
  }, [applyTokenFromStorage]);

  // Web3-only session: active wallet must match JWT identity
  useEffect(() => {
    if (!state.accessToken || state.username) return;
    const p = decodeJwtPayload(state.accessToken);
    if (!p?.walletAddress || !wagmiAddress) return;
    if (wagmiAddress.toLowerCase() !== p.walletAddress.toLowerCase()) {
      toast.error('Wallet account changed. Please sign in again with this wallet.');
      disconnect();
    }
  }, [state.accessToken, state.username, wagmiAddress, disconnect]);

  // Auth verification effect when address changes
  useEffect(() => {
    const verifyWallet = async () => {
      if (!wagmiAddress || state.accessToken || state.blockWeb3AutoVerify) return;
      await loginWeb3(wagmiAddress);
    };
    void verifyWallet();
  }, [wagmiAddress, state.accessToken, state.blockWeb3AutoVerify, loginWeb3]);

  const loginUser = useCallback(async (username: string, passwordPlain: string) => {
    try {
      const { data } = await api.post<{
        accessToken: string;
        role: UserRole;
        username: string;
      }>('/auth/login', { username, passwordPlain });
      
      setAuthToken(data.accessToken);
      setState(prev => ({
        ...prev,
        isConnected: true,
        address: null,
        username: data.username,
        walletType: null,
        accessToken: data.accessToken,
        role: data.role,
        needsReAuth: false,
        needsRoleSelection: false,
        blockWeb3AutoVerify: false,
      }));
      toast.success('Logged in successfully');
      return data;
    } catch (e) {
      toast.error(getErrorMessage(e));
      throw e;
    }
  }, []);

  const registerUser = useCallback(
    async (
      username: string,
      passwordPlain: string,
      role: UserRole,
      profile: { displayName: string; email: string; country: string },
    ) => {
    try {
      const { data } = await api.post<{
        accessToken: string;
        role: UserRole;
        username: string;
      }>('/auth/register', {
        username,
        passwordPlain,
        role,
        displayName: profile.displayName,
        email: profile.email,
        country: profile.country,
      });
      
      setAuthToken(data.accessToken);
      setState(prev => ({
        ...prev,
        isConnected: true,
        address: null,
        username: data.username,
        walletType: null,
        accessToken: data.accessToken,
        role: data.role,
        needsReAuth: false,
        needsRoleSelection: false,
        blockWeb3AutoVerify: false,
      }));
      toast.success('Registered successfully');
      return data;
    } catch (e) {
      toast.error(getErrorMessage(e));
      throw e;
    }
  }, []);

  const selectRole = useCallback(
    async (role: UserRole) => {
      if (!state.accessToken) {
        setState((prev) => ({ ...prev, role, needsRoleSelection: false }));
        return;
      }
      try {
        const { data } = await api.post<{ accessToken: string; role: UserRole }>('/auth/role', { role });
        setAuthToken(data.accessToken);
        setState((prev) => ({
          ...prev,
          role: data.role,
          accessToken: data.accessToken,
          needsRoleSelection: false,
          blockWeb3AutoVerify: false,
        }));
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
    },
    [state.accessToken],
  );

  const setNeedsReAuth = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, needsReAuth: v }));
  }, []);

  // Listen for unauthorized events from API
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('[WalletContext] Unauthorized event received - triggering re-auth');
      setState(prev => ({ ...prev, needsReAuth: true }));
    };

    window.addEventListener('yield_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('yield_unauthorized', handleUnauthorized);
  }, []);
  return (
    <WalletContext.Provider
      value={{
        ...state,
        authHydrated,
        connect,
        logoutSession,
        disconnect,
        selectRole,
        loginUser,
        registerUser,
        setNeedsReAuth,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
