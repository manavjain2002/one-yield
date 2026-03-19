import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import type { LenderPosition } from '@/data/mockData';
import { mockLenderPositions } from '@/data/mockData';
import { useWallet } from '@/contexts/WalletContext';

type ApiPosition = {
  poolId: string;
  lenderAddress: string;
  lpTokenBalance: string;
  depositedAmount: string;
  currentValue: string;
  yieldEarned: string;
  pool?: { name: string; contractAddress: string };
};

function mapPosition(p: ApiPosition): LenderPosition {
  return {
    poolId: p.poolId,
    poolName: p.pool?.name ?? 'Pool',
    deposited: Number(p.depositedAmount) || 0,
    currentValue: Number(p.currentValue) || 0,
    yield: Number(p.yieldEarned) || 0,
    pending: 0,
    lpTokens: Number(p.lpTokenBalance) || 0,
  };
}

export function useLenderPositions() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['lender-positions', accessToken],
    queryFn: async (): Promise<LenderPosition[]> => {
      if (!isApiConfigured() || !accessToken) return mockLenderPositions;
      const { data } = await api.get<ApiPosition[]>('/lender/positions');
      return (data ?? []).map(mapPosition);
    },
  });
}
