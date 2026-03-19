import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import type { TxHistory } from '@/data/mockData';
import { mockTxHistory } from '@/data/mockData';
type ApiTx = {
  id: string;
  txHash: string;
  type: string;
  amount: string | null;
  status: string;
  createdAt: string;
  tokenAddress?: string | null;
};

function mapTx(t: ApiTx): TxHistory {
  const st = t.status === 'confirmed' || t.status === 'pending' || t.status === 'failed' ? t.status : 'pending';
  const ty = ['borrow', 'repay', 'deposit', 'withdraw', 'transfer'].includes(t.type)
    ? (t.type as TxHistory['type'])
    : 'transfer';
  return {
    id: t.id,
    type: ty,
    amount: Number(t.amount) || 0,
    token: t.tokenAddress ?? 'USDC',
    timestamp: t.createdAt,
    txHash: t.txHash,
    status: st,
  };
}

export function usePoolTxHistory(poolIdOrAddress: string | undefined) {
  return useQuery({
    queryKey: ['tx-history', poolIdOrAddress],
    enabled: Boolean(poolIdOrAddress),
    queryFn: async (): Promise<TxHistory[]> => {
      if (!poolIdOrAddress) return [];
      if (!isApiConfigured()) return mockTxHistory;
      try {
        const { data } = await api.get<ApiTx[]>(
          `/pools/${poolIdOrAddress}/transactions`,
        );
        return (data ?? []).map(mapTx);
      } catch {
        return mockTxHistory;
      }
    },
  });
}
