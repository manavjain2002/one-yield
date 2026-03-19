import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import { mapApiPoolToUi, type ApiPool } from '@/lib/pool-mapper';
import type { Pool } from '@/data/mockData';
import { mockPools } from '@/data/mockData';

export function useBorrowerPoolsList() {
  return useQuery({
    queryKey: ['borrower', 'pools'],
    queryFn: async (): Promise<Pool[]> => {
      if (!isApiConfigured()) {
        return mockPools;
      }
      try {
        const { data } = await api.get<ApiPool[]>('/borrower/pools');
        return (data ?? []).map(mapApiPoolToUi);
      } catch {
        return [];
      }
    },
  });
}
