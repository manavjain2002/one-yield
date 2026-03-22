import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import type { BorrowerMyPoolApiRow } from '@/lib/borrower-metrics-types';
import { mapBorrowerMyPoolRowToUi, type BorrowerMyPoolUi } from '@/lib/borrower-metrics-types';
import { useWallet } from '@/contexts/WalletContext';

/** Requirement 8 — My Pools page only (GET /borrower/pools). */
export function useBorrowerMyPools() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['borrower', 'my-pools', accessToken],
    queryFn: async (): Promise<BorrowerMyPoolUi[]> => {
      if (!isApiConfigured() || !accessToken) return [];
      const { data } = await api.get<BorrowerMyPoolApiRow[]>('/borrower/pools');
      const rows = data ?? [];
      return rows.map(mapBorrowerMyPoolRowToUi);
    },
    enabled: Boolean(isApiConfigured() && accessToken),
  });
}
