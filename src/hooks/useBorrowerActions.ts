import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from 'sonner';

interface RepayParams {
  poolId: string;
  v1PoolId: string;
  amount: string;
  fee: string;
}

export function useBorrowerActions() {
  const queryClient = useQueryClient();

  const repay = useMutation({
    mutationFn: async (params: RepayParams) => {
      const { data } = await api.post('/borrower/repay', params);
      return data;
    },
    onSuccess: () => {
      toast.success('Repayment transaction initiated');
      queryClient.invalidateQueries({ queryKey: ['borrower', 'dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['borrower', 'dashboard-active-pools'] });
      queryClient.invalidateQueries({ queryKey: ['borrower', 'my-pools'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  return {
    repay,
    isPending: repay.isPending,
  };
}
