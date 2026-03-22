import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import type { BorrowerActivePoolApiRow } from '@/lib/borrower-metrics-types';
import { mapBorrowerActivePoolRowToUi, type BorrowerDashboardActivePoolUi } from '@/lib/borrower-metrics-types';
import { useWallet } from '@/contexts/WalletContext';

export function useBorrowerDashboardActivePools() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['borrower', 'dashboard-active-pools', accessToken],
    queryFn: async (): Promise<BorrowerDashboardActivePoolUi[]> => {
      if (!isApiConfigured() || !accessToken) return [];
      const { data } = await api.get<BorrowerActivePoolApiRow[]>('/borrower/dashboard/active-pools');
      const rows = data ?? [];
      return rows.map(mapBorrowerActivePoolRowToUi);
    },
    enabled: Boolean(isApiConfigured() && accessToken),
  });
}
