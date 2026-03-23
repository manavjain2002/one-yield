import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { parseUnits } from 'ethers';
import { api, getErrorMessage } from '@/lib/api';
import { getAssetManager, getERC20, getERC20Read } from '@/lib/contracts';
import type { Pool } from '@/data/mockData';
import { getTokenDecimalInputError } from '@/lib/erc20-amount';

export function useRepay() {
  const queryClient = useQueryClient();

  const repayLoan = useMutation({
    mutationFn: async ({ pool, amount }: { pool: Pool; amount: string }) => {
      if (!amount?.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
        throw new Error('Please enter a valid amount to repay.');
      }

      const v1PoolId = pool.borrowerPools?.[0]?.v1PoolId;
      if (!v1PoolId) {
        throw new Error('Cannot repay: no borrower assignment (v1PoolId) found for this pool.');
      }

      const fmAddress = pool.fundManagerAddress;
      if (!fmAddress) {
        throw new Error('Fund Manager address is not available.');
      }

      let decimals = 6;
      try {
        const tokenRead = getERC20Read(pool.poolTokenAddress);
        decimals = Number(await tokenRead.decimals());
      } catch {
        console.warn('Failed to fetch token decimals, defaulting to 6');
      }

      const inputErr = getTokenDecimalInputError(amount, '0', decimals);
      if (inputErr) throw new Error(inputErr);

      const parsedAmount = parseUnits(amount.trim(), decimals);
      const fee = 0n;

      const tid = toast.loading('Waiting for MetaMask signature to approve token...');
      try {
        const recordTx = async (txHash: string, type: string, amt: string) => {
          try {
            await api.post('/pools/record-activity', {
              txHash,
              type,
              amount: parseUnits(amt.trim(), decimals).toString(),
              poolId: pool.id,
              tokenAddress: pool.poolTokenAddress,
              toAddress: pool.fundManagerAddress,
            });
          } catch (e) {
            console.error('[Audit] Failed to record:', e);
          }
        };

        const token = await getERC20(pool.poolTokenAddress);
        const approveTx = await token.approve(fmAddress, parsedAmount + fee);
        toast.loading('Approving tokens...', { id: tid });
        await recordTx(approveTx.hash, 'transfer', amount);
        await approveTx.wait();

        toast.loading('Waiting for MetaMask signature to repay loan...', { id: tid });
        const fm = await getAssetManager(fmAddress);
        const payTx = await fm.pay(v1PoolId, parsedAmount, fee);
        toast.loading('Repaying loan...', { id: tid });
        await recordTx(payTx.hash, 'repay', amount);
        await payTx.wait();

        toast.success(`Successfully repaid $${amount} to pool!`, { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: (_, { pool }) => {
      void queryClient.invalidateQueries({ queryKey: ['pool', pool.id] });
      void queryClient.invalidateQueries({ queryKey: ['txHistory', pool.id] });
    },
  });

  return { repayLoan };
}
