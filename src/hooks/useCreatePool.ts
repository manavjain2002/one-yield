import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type CreatePoolPayload = {
  name: string;
  symbol: string;
  /** USDC smallest units (6 decimals), as decimal string */
  poolSize: string;
  apyBasisPoints?: number;
};

export function useCreatePool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePoolPayload) => {
      const { data } = await api.post<{ jobId: string; draftId: string }>(
        '/pools',
        body,
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'pools'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
  });
}
