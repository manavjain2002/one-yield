import { createContext, useContext, useState, useCallback } from 'react';

interface TransactionContextType {
  isTransacting: boolean;
  txMessage: string;
  startTransaction: (message?: string) => void;
  endTransaction: () => void;
}

const TransactionContext = createContext<TransactionContextType>({
  isTransacting: false,
  txMessage: '',
  startTransaction: () => {},
  endTransaction: () => {},
});

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [isTransacting, setIsTransacting] = useState(false);
  const [txMessage, setTxMessage] = useState('');

  const startTransaction = useCallback((message = 'Transaction in progress...') => {
    setIsTransacting(true);
    setTxMessage(message);
  }, []);

  const endTransaction = useCallback(() => {
    setIsTransacting(false);
    setTxMessage('');
  }, []);

  return (
    <TransactionContext.Provider value={{ isTransacting, txMessage, startTransaction, endTransaction }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransaction() {
  return useContext(TransactionContext);
}
