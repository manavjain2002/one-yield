import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import { mapApiPoolToUi, type ApiPool } from '@/lib/pool-mapper';
import type { Pool } from '@/data/mockData';
import { mockPools } from '@/data/mockData';
export function usePool(poolId: string | undefined) {
  return useQuery({
    queryKey: ['pool', poolId],
    enabled: Boolean(poolId),
    queryFn: async (): Promise<Pool | null> => {
      if (!poolId) return null;
      if (!isApiConfigured()) {
        return mockPools.find((p) => p.id === poolId) ?? null;
      }
      try {
        const { data } = await api.get<ApiPool>(`/pools/${poolId}`);
        return data ? mapApiPoolToUi(data) : null;
      } catch {
        return mockPools.find((p) => p.id === poolId) ?? null;
      }
    },
  });
}
