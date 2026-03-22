import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getLendingPoolRead } from '@/lib/contracts';

const STALE_MS = 20_000;

/**
 * Reads lending pool `paused()` with caching tuned for admin/manager lists (fewer refetches, less spinner flicker).
 */
export function usePoolContractPaused(contractAddress: string | undefined) {
  const addr = contractAddress?.trim() || '';

  return useQuery({
    queryKey: ['pool-paused', addr],
    queryFn: async () => {
      if (!addr) return false;
      return await getLendingPoolRead(addr).paused();
    },
    enabled: Boolean(addr),
    staleTime: STALE_MS,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
}
