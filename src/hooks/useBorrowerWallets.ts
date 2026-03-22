import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

export type BorrowerWallet = {
  id: string;
  borrowerIdentifier: string;
  walletAddress: string;
  tokenAddress: string;
};

export function useBorrowerWallets() {
  return useQuery({
    queryKey: ['borrower', 'wallets'],
    queryFn: async () => {
      const { data } = await api.get<BorrowerWallet[]>('/borrower/wallets');
      return data;
    },
  });
}

export function useSetBorrowerWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tokenAddress, walletAddress }: { tokenAddress: string; walletAddress: string }) => {
      const { data } = await api.post<BorrowerWallet>('/borrower/wallets', { tokenAddress, walletAddress });
      return data;
    },
    onSuccess: () => {
      toast.success('Wallet updated successfully');
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'wallets'] });
    },
    onError: (e) => {
      toast.error(getErrorMessage(e));
    },
  });
}

export function useUpdateBorrowerWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, walletAddress }: { id: string; walletAddress: string }) => {
      const { data } = await api.patch<BorrowerWallet>(`/borrower/wallets/${id}`, { walletAddress });
      return data;
    },
    onSuccess: () => {
      toast.success('Wallet updated successfully');
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'wallets'] });
    },
    onError: (e) => {
      toast.error(getErrorMessage(e));
    },
  });
}

export function useDeleteBorrowerWallet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/borrower/wallets/${id}`);
    },
    onSuccess: () => {
      toast.success('Wallet removed');
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'wallets'] });
    },
    onError: (e) => {
      toast.error(getErrorMessage(e));
    },
  });
}
