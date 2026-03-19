import React, { createContext, useContext, useState, useCallback } from 'react';

export type UserRole = 'borrower' | 'lender' | 'manager';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  role: UserRole | null;
  balance: number;
  network: 'mainnet' | 'testnet';
}

interface WalletContextType extends WalletState {
  connect: (wallet: 'hashpack' | 'blade') => void;
  disconnect: () => void;
  selectRole: (role: UserRole) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

const MOCK_ADDRESS = '0.0.4515312';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    role: null,
    balance: 12450.75,
    network: 'testnet',
  });

  const connect = useCallback((wallet: 'hashpack' | 'blade') => {
    setState(prev => ({ ...prev, isConnected: true, address: MOCK_ADDRESS }));
  }, []);

  const disconnect = useCallback(() => {
    setState({ isConnected: false, address: null, role: null, balance: 12450.75, network: 'testnet' });
  }, []);

  const selectRole = useCallback((role: UserRole) => {
    setState(prev => ({ ...prev, role }));
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect, selectRole }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}
