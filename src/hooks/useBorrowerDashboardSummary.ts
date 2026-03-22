import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import type { BorrowerDashboardSummaryDto } from '@/lib/borrower-metrics-types';
import { useWallet } from '@/contexts/WalletContext';

export function useBorrowerDashboardSummary() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['borrower', 'dashboard-summary', accessToken],
    queryFn: async (): Promise<BorrowerDashboardSummaryDto> => {
      if (!isApiConfigured() || !accessToken) {
        return {
          outstandingPrincipalNominal: 0,
          outstandingCouponNominal: 0,
          totalDebtNominal: 0,
          activePoolCount: 0,
        };
      }
      const { data } = await api.get<BorrowerDashboardSummaryDto>('/borrower/dashboard/summary');
      return data ?? {
        outstandingPrincipalNominal: 0,
        outstandingCouponNominal: 0,
        totalDebtNominal: 0,
        activePoolCount: 0,
      };
    },
    enabled: Boolean(isApiConfigured() && accessToken),
  });
}
