import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { api, setAuthToken, loadStoredToken, isApiConfigured, getErrorMessage } from '@/lib/api';
import { useAccount, useDisconnect, useBalance, useSignMessage } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

export type WalletKind = 'metamask' | 'walletconnect';

export type UserRole = 'borrower' | 'lender' | 'manager';

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
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  selectRole: (role: UserRole) => Promise<void>;
  loginUser: (username: string, passwordPlain: string) => Promise<void>;
  registerUser: (username: string, passwordPlain: string, role: UserRole) => Promise<void>;
  setNeedsReAuth: (v: boolean) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

function decodeJwtPayload(token: string): {
  walletAddress?: string;
  username?: string;
  role?: UserRole;
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
  });

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
        }));
      }
    }
  }, []);

  // Sync state with wagmi
  useEffect(() => {
    if (wagmiIsConnected && wagmiAddress) {
      setState(prev => ({
        ...prev,
        isConnected: true,
        address: wagmiAddress,
        balance: balanceData ? Number(balanceData.formatted) : prev.balance,
      }));
    } else if (!wagmiIsConnected && state.address) {
      // ONLY disconnect if the role strictly requires a wallet (Lender/Manager)
      // Borrowers and Admins using ID/Pass should NOT be disconnected by wagmi
      if (state.role === 'lender' || state.role === 'manager') {
        if (!state.username) { // If it's a pure Web3 user
          console.log('[WalletContext] Web3 disconnected - logging out');
          disconnect();
        }
      }
    }
  }, [wagmiIsConnected, wagmiAddress, balanceData]);

  const disconnect = useCallback(() => {
    setAuthToken(null);
    wagmiDisconnect();
    setState({
      isConnected: false,
      address: null,
      username: null,
      role: null,
      balance: 0,
      network: import.meta.env.VITE_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
      accessToken: null,
      walletType: null,
      needsReAuth: false,
    });
  }, [wagmiDisconnect]);

  const connect = useCallback(async () => {
    const useMock = import.meta.env.VITE_USE_MOCK_WALLET === 'true' || !isApiConfigured();

    if (useMock) {
      setState((prev) => ({
        ...prev,
        isConnected: true,
        address: '0x0000000000000000000000000000000000000001',
        walletType: 'metamask',
        balance: 12450.75,
      }));
      toast.success('Connected (mock wallet)');
      return;
    }

    if (openConnectModal) {
      openConnectModal();
    } else {
      toast.error('Connect modal not available');
    }
  }, [openConnectModal]);

  const loginWeb3 = useCallback(async (walletAddress: string) => {
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
      setState((prev) => ({
        ...prev,
        isConnected: true,
        address: auth.walletAddress,
        accessToken: auth.accessToken,
        role: auth.role,
        needsReAuth: false,
      }));
      
      toast.success('Web3 identity verified');
    } catch (e) {
      console.error('[WalletContext] Web3 login failed:', e);
      toast.error('Web3 login failed: ' + getErrorMessage(e));
      // If login fails, we might want to disconnect to avoid being stuck in a half-connected state
      disconnect();
    }
  }, [signMessageAsync, disconnect]);

  // Auth verification effect when address changes
  useEffect(() => {
    const verifyWallet = async () => {
      if (wagmiAddress && !state.accessToken) {
        await loginWeb3(wagmiAddress);
      }
    };
    void verifyWallet();
  }, [wagmiAddress, state.accessToken, loginWeb3]);

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
      }));
      toast.success('Logged in successfully');
    } catch (e) {
      toast.error(getErrorMessage(e));
      throw e;
    }
  }, []);

  const registerUser = useCallback(async (username: string, passwordPlain: string, role: UserRole) => {
    try {
      const { data } = await api.post<{
        accessToken: string;
        role: UserRole;
        username: string;
      }>('/auth/register', { username, passwordPlain, role });
      
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
      }));
      toast.success('Registered successfully');
    } catch (e) {
      toast.error(getErrorMessage(e));
      throw e;
    }
  }, []);

  const selectRole = useCallback(
    async (role: UserRole) => {
      if (!state.accessToken) {
        setState((prev) => ({ ...prev, role }));
        return;
      }
      try {
        const { data } = await api.post<{ accessToken: string; role: UserRole }>('/auth/role', { role });
        setAuthToken(data.accessToken);
        setState((prev) => ({ ...prev, role: data.role, accessToken: data.accessToken }));
      } catch (e) {
        toast.error(getErrorMessage(e));
        setState((prev) => ({ ...prev, role }));
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
      value={{ ...state, connect, disconnect, selectRole, loginUser, registerUser, setNeedsReAuth }}
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
