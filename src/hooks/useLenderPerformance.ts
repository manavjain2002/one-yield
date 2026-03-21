import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import { useWallet } from '@/contexts/WalletContext';

export function useLenderPerformance() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['lender-performance', accessToken],
    queryFn: async () => {
      if (!isApiConfigured() || !accessToken) return [];
      const { data } = await api.get('/lender/performance');
      return data;
    },
    enabled: !!accessToken,
  });
}
