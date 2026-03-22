import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import type { LenderPosition } from '@/data/mockData';
import { useWallet } from '@/contexts/WalletContext';

type ApiPosition = {
  poolId: string;
  lenderAddress: string;
  lpTokenBalance: string;
   depositedAmount: string;
  withdrawnAmount: string;
  currentValue: string;
  yieldEarned: string;
  pool?: { name: string; contractAddress: string; poolTokenAddress: string };
};

function mapPosition(p: ApiPosition): LenderPosition {
  return {
    poolId: p.poolId,
    poolName: p.pool?.name ?? 'Pool',
    contractAddress: p.pool?.contractAddress,
    poolTokenAddress: p.pool?.poolTokenAddress,
    deposited: (Number(p.depositedAmount) || 0) / 1e6,
    withdrawn: (Number(p.withdrawnAmount) || 0) / 1e6,
    currentValue: (Number(p.currentValue) || 0) / 1e6,
    yield: (Number(p.yieldEarned) || 0) / 1e6,
    pending: 0,
    lpTokens: (Number(p.lpTokenBalance) || 0) / 1e6,
  };
}

export function useLenderPositions() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['lender-positions', accessToken],
    queryFn: async (): Promise<LenderPosition[]> => {
      if (!isApiConfigured() || !accessToken) return [];
      try {
        const { data } = await api.get<ApiPosition[]>('/lender/positions');
        return (data ?? []).map(mapPosition);
      } catch {
        return [];
      }
    },
  });
}
