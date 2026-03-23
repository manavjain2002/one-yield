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

/** Matches backend `getManagerTransactions` category filter (manager role only). */
export type ManagerTxCategory =
  | 'all'
  | 'deposits'
  | 'withdrawals'
  | 'repayments'
  | 'deployments'
  | 'operations';

export function useTransactionHistory(
  page: number = 1,
  limit: number = 10,
  category?: ManagerTxCategory,
) {
  const { role, isConnected } = useWallet();

  return useQuery({
    queryKey: ['transactions', role, page, limit, category],
    queryFn: async (): Promise<PaginatedTransactions> => {
      const endpoint = role === 'manager' ? '/manager/transactions' : `/${role}/transactions`;
      const params: Record<string, string | number> = { page, limit };
      if (role === 'manager' && category && category !== 'all') {
        params.category = category;
      }
      const { data } = await api.get<PaginatedTransactions>(endpoint, { params });
      return data;
    },
    enabled: isConnected && !!role,
  });
}
