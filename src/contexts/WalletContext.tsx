import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { api, setAuthToken, loadStoredToken, isApiConfigured, getErrorMessage } from '@/lib/api';
import { pairMetaMask } from '@/lib/hedera/metamask';
import type { PairingResult } from '@/lib/hedera/types';
import { HEDERA_EVM_RPC_URL } from '@/lib/chain-constants';

// When re-enabling HashPack / Blade, extend this type and uncomment imports + branches in `connect` below.
// import { pairHashPack } from '@/lib/hedera/hashconnect';
// import { pairBlade } from '@/lib/hedera/blade';
// export type WalletKind = 'hashpack' | 'blade' | 'metamask';
export type WalletKind = 'metamask';

export type UserRole = 'borrower' | 'lender' | 'manager';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  role: UserRole | null;
  balance: number;
  network: 'mainnet' | 'testnet';
  accessToken: string | null;
  walletType: WalletKind | null;
}

interface WalletContextType extends WalletState {
  /** MetaMask-only for now (Hedera EVM). */
  connect: () => Promise<void>;
  disconnect: () => void;
  selectRole: (role: UserRole) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

/** Mock MetaMask path uses an EVM address (no Hedera account id required). */
const MOCK_EVM_ADDRESS =
  (import.meta.env.VITE_MOCK_WALLET_EVM as string | undefined) ??
  '0x0000000000000000000000000000000000000001';

async function fetchHbarBalance(hederaAccountId: string): Promise<number> {
  const base =
    import.meta.env.VITE_MIRROR_NODE_URL ??
    'https://testnet.mirrornode.hedera.com';
  try {
    const r = await fetch(`${base}/api/v1/accounts/${hederaAccountId}`);
    if (!r.ok) return 0;
    const j = (await r.json()) as { balance?: { balance?: number } };
    const tinybars = j.balance?.balance ?? 0;
    return tinybars / 100_000_000;
  } catch {
    return 0;
  }
}

/** MetaMask / Hedera EVM: native balance via JSON-RPC (HBAR on EVM side). */
async function fetchEvmNativeBalance(evmAddress: string): Promise<number> {
  try {
    const res = await fetch(HEDERA_EVM_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [evmAddress.trim(), 'latest'],
      }),
    });
    const j = (await res.json()) as { result?: string };
    const wei = BigInt(j.result ?? '0x0');
    return Number(wei) / 1e18;
  } catch {
    return 0;
  }
}

async function fetchWalletBalance(walletRef: string): Promise<number> {
  const w = walletRef.trim();
  if (/^0x[a-fA-F0-9]{40}$/i.test(w)) {
    return fetchEvmNativeBalance(w);
  }
  return fetchHbarBalance(w);
}

function decodeJwtPayload(token: string): {
  accountId?: string;
  role?: UserRole;
} | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = JSON.parse(atob(b64 + pad)) as {
      accountId?: string;
      role?: UserRole;
    };
    return json;
  } catch {
    return null;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    role: null,
    balance: 0,
    network:
      import.meta.env.VITE_HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
    accessToken: null,
    walletType: null,
  });

  useEffect(() => {
    const t = loadStoredToken();
    if (t) {
      const payload = decodeJwtPayload(t);
      setState((prev) => ({
        ...prev,
        accessToken: t,
        address: payload?.accountId ?? prev.address,
        role: payload?.role ?? prev.role,
        isConnected: Boolean(payload?.accountId),
        walletType: payload?.accountId ? 'metamask' : prev.walletType,
      }));
      if (payload?.accountId) {
        void fetchWalletBalance(payload.accountId).then((bal) => {
          setState((p) => ({ ...p, balance: bal }));
        });
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setAuthToken(null);
    setState({
      isConnected: false,
      address: null,
      role: null,
      balance: 0,
      network:
        import.meta.env.VITE_HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
      accessToken: null,
      walletType: null,
    });
  }, []);

  const connect = useCallback(async () => {
    const useMock =
      import.meta.env.VITE_USE_MOCK_WALLET === 'true' || !isApiConfigured();

    if (useMock) {
      setAuthToken(null);
      setState((prev) => ({
        ...prev,
        isConnected: true,
        address: MOCK_EVM_ADDRESS,
        walletType: 'metamask',
        balance: 12450.75,
        accessToken: null,
      }));
      toast.success(
        'Connected (mock wallet — set VITE_API_URL + MetaMask for production)',
      );
      return;
    }

    const tid = toast.loading('Connect MetaMask…');
    try {
      let pair: PairingResult;

      pair = await pairMetaMask();

      // HashPack — uncomment when needed:
      // pair = await pairHashPack();
      // Blade — uncomment when needed:
      // pair = await pairBlade();

      const { accountId, signUtf8 } = pair;
      const { data: ch } = await api.post<{ challengeId: string; message: string }>(
        '/auth/challenge',
        { accountId },
      );
      const signatureHex = await signUtf8(ch.message);
      const { data: auth } = await api.post<{
        accessToken: string;
        role: UserRole;
        accountId: string;
      }>('/auth/verify', {
        accountId,
        challengeId: ch.challengeId,
        signatureHex,
      });
      setAuthToken(auth.accessToken);
      const bal = await fetchWalletBalance(auth.accountId);
      setState((prev) => ({
        ...prev,
        isConnected: true,
        address: auth.accountId,
        walletType: 'metamask',
        balance: bal,
        accessToken: auth.accessToken,
        role: auth.role ?? prev.role,
      }));
      toast.success('Wallet connected', { id: tid });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: tid });
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
        await api.post('/auth/role', { role });
        setState((prev) => ({ ...prev, role }));
      } catch (e) {
        toast.error(getErrorMessage(e));
        setState((prev) => ({ ...prev, role }));
      }
    },
    [state.accessToken],
  );

  return (
    <WalletContext.Provider
      value={{ ...state, connect, disconnect, selectRole }}
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
