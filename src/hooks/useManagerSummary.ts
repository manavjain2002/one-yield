import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import { mapApiPoolToUi, type ApiPool } from '@/lib/pool-mapper';
import type { Pool } from '@/data/mockData';
import { mockPools } from '@/data/mockData';
import { useWallet } from '@/contexts/WalletContext';

type ManagerApiResponse = {
  poolCount: number;
  totalAssetUnderManagement: string;
  pools: ApiPool[];
};

export function useManagerSummary() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['manager-summary', accessToken],
    queryFn: async () => {
      if (!isApiConfigured() || !accessToken) {
        const totalAum = mockPools.reduce((s, p) => s + p.totalReceived, 0);
        return {
          poolCount: mockPools.length,
          totalAssetUnderManagement: String(totalAum),
          poolsUi: mockPools,
        };
      }
      const { data } = await api.get<ManagerApiResponse>('/manager/aum');
      const poolsUi: Pool[] = (data?.pools ?? []).map(mapApiPoolToUi);
      return {
        poolCount: data?.poolCount ?? 0,
        totalAssetUnderManagement: data?.totalAssetUnderManagement ?? '0',
        poolsUi,
      };
    },
  });
}
