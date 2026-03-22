import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';
import { useWallet } from '@/contexts/WalletContext';
import type { AdminDraftBorrowerProfile, AdminPoolDraftDetail } from '@/hooks/useAdminPoolActions';

export type AdminPoolDraftSummary = {
  id: string;
  borrowerIdentifier: string;
  name: string;
  symbol: string;
  apyBasisPoints: number;
  poolSize: string;
  poolTokenAddress: string;
  hasDocument: boolean;
  documentOriginalName: string | null;
  createdAt: string;
  borrower?: AdminDraftBorrowerProfile | null;
};

export function useAdminPoolDrafts() {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['admin', 'pool-drafts', accessToken],
    queryFn: async () => {
      if (!isApiConfigured() || !accessToken) return [] as AdminPoolDraftSummary[];
      const { data } = await api.get<AdminPoolDraftSummary[]>('/admin/pool-drafts');
      return data ?? [];
    },
    enabled: Boolean(accessToken),
  });
}

export function useAdminPoolDraft(id: string | undefined) {
  const { accessToken } = useWallet();

  return useQuery({
    queryKey: ['admin', 'pool-drafts', 'detail', id, accessToken],
    queryFn: async () => {
      if (!isApiConfigured() || !accessToken || !id) return null;
      const { data } = await api.get<AdminPoolDraftDetail>(`/admin/pool-drafts/${id}`);
      return data;
    },
    enabled: Boolean(accessToken && id),
  });
}
