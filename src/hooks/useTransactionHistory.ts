import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWallet } from '@/contexts/WalletContext';
import type { Transaction } from '@/components/TransactionList';

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useTransactionHistory(page: number = 1, limit: number = 10) {
  const { role, isConnected } = useWallet();

  return useQuery({
    queryKey: ['transactions', role, page, limit],
    queryFn: async (): Promise<PaginatedTransactions> => {
      // Endpoint depends on role
      const endpoint = role === 'manager' ? '/manager/transactions' : `/${role}/transactions`;
      const { data } = await api.get<PaginatedTransactions>(endpoint, {
        params: { page, limit },
      });
      return data;
    },
    enabled: isConnected && !!role,
  });
}
