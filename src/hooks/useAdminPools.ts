import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import { mapApiPoolToUi, type ApiPool } from '@/lib/pool-mapper';
import type { Pool } from '@/data/mockData';
import { useWallet } from '@/contexts/WalletContext';

export function useAdminPools() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['admin', 'pools', accessToken],
    queryFn: async () => {
      if (!isApiConfigured() || !accessToken) return [] as Pool[];
      const { data } = await api.get<ApiPool[]>('/admin/pools');
      return (data ?? []).map(mapApiPoolToUi);
    },
    enabled: Boolean(accessToken),
  });
}
