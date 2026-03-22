import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, isApiConfigured } from '@/lib/api';

export type CreatePoolPayload = {
  name: string;
  symbol: string;
  /** USDC smallest units (6 decimals), as decimal string */
  poolSize: string;
  apyBasisPoints?: number;
  poolTokenAddress?: string;
  file?: File;
};

/**
 * Creates a pool by sending data directly to the backend.
 * The backend signs and executes the blockchain transaction.
 */
export function useCreatePool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreatePoolPayload) => {
      if (!isApiConfigured()) throw new Error('Backend API not configured');
      if (!payload.file) throw new Error('Loan tape file is required');

      const formData = new FormData();
      formData.append('name', payload.name);
      formData.append('symbol', payload.symbol);
      formData.append('poolSize', payload.poolSize);
      
      if (payload.apyBasisPoints !== undefined) {
        formData.append('apyBasisPoints', payload.apyBasisPoints.toString());
      }
      if (payload.poolTokenAddress) {
        formData.append('poolTokenAddress', payload.poolTokenAddress);
      }
      formData.append('file', payload.file);

      const tid = toast.loading('Submitting pool draft...');
      try {
        const { data } = await api.post('/pools', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        toast.success(
          (data as { message?: string })?.message ?? 'Draft submitted for admin review.',
          { id: tid },
        );
        return data;
      } catch (err: unknown) {
        const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
        const reason = anyErr.response?.data?.message ?? anyErr.message ?? 'Submission failed';
        console.error('❌ createPool failed:', reason, err);
        toast.error(`Transaction failed: ${reason}`, { id: tid });
        throw err;
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'dashboard-active-pools'] });
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'my-pools'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
  });
}
