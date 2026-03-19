import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import { mapApiPoolToUi, type ApiPool } from '@/lib/pool-mapper';
import type { Pool } from '@/data/mockData';
import { mockPools } from '@/data/mockData';
export function usePoolsList(status?: string) {
  return useQuery({
    queryKey: ['pools', status],
    queryFn: async (): Promise<Pool[]> => {
      if (!isApiConfigured()) return mockPools;
      try {
        const params = status ? { status } : {};
        const { data } = await api.get<ApiPool[]>('/pools', { params });
        return (data ?? []).map(mapApiPoolToUi);
      } catch {
        return mockPools;
      }
    },
  });
}
