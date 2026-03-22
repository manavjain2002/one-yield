import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import type { TxHistory, TxHistoryType } from '@/data/mockData';
type ApiTx = {
  id: string;
  txHash: string;
  type: string;
  amount: string | null;
  status: string;
  createdAt: string;
  tokenAddress?: string | null;
};

const KNOWN_TYPES = new Set<string>([
  'borrow',
  'repay',
  'deposit',
  'withdraw',
  'transfer',
  'create_pool',
  'deploy_funds',
  'activate',
  'pause',
  'unpause',
  'send_to_reserve',
  'aum_update',
  'other',
]);

function mapTx(t: ApiTx): TxHistory {
  const st = t.status === 'confirmed' || t.status === 'pending' || t.status === 'failed' ? t.status : 'pending';
  const raw = (t.type || '').toLowerCase();
  const ty: TxHistoryType = KNOWN_TYPES.has(raw) ? (raw as TxHistoryType) : 'other';
  return {
    id: t.id,
    type: ty,
    amount: (Number(t.amount) || 0) / 1e6,
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
      if (!isApiConfigured()) return [];
      try {
        const { data } = await api.get<ApiTx[]>(
          `/pools/${poolIdOrAddress}/transactions`,
        );
        return (data ?? []).map(mapTx);
      } catch {
        return [];
      }
    },
  });
}
