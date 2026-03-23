import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { parseUnits } from 'ethers';
import { getERC20, getERC20Read, getAssetManager } from '@/lib/contracts';
import { api, getErrorMessage } from '@/lib/api';
import { getTokenDecimalInputError } from '@/lib/erc20-amount';

interface UseBorrowerWeb3ActionsProps {
  poolTokenAddress: string;
  fundManagerAddress: string;
  poolId: string;
}

async function resolveDecimals(poolTokenAddress: string, cached: number | undefined): Promise<number> {
  let decimals = cached ?? 6;
  try {
    decimals = Number(await getERC20Read(poolTokenAddress).decimals());
  } catch {
    /* keep cached/default */
  }
  return decimals;
}

export function useBorrowerWeb3Actions({ poolTokenAddress, fundManagerAddress, poolId }: UseBorrowerWeb3ActionsProps) {
  const { address: wagmiAddress, isConnected } = useAccount();
  const queryClient = useQueryClient();

  const decimalsQuery = useQuery({
    queryKey: ['erc20-decimals', poolTokenAddress],
    queryFn: async () => {
      if (!poolTokenAddress) return 6;
      try {
        return Number(await getERC20Read(poolTokenAddress).decimals());
      } catch {
        return 6;
      }
    },
    enabled: !!poolTokenAddress,
    staleTime: 60_000,
  });

  const isDecimalsReady = !!poolTokenAddress && decimalsQuery.isFetched;
  const isDecimalsLoading = !!poolTokenAddress && decimalsQuery.isLoading;

  const confirmTx = async (txHash: string, type: string, poolId?: string, v1PoolId?: string) => {
    try {
      await api.post('/pools/confirm-tx', { txHash, type, poolId, v1PoolId });
    } catch (e) {
      console.error('[ConfirmTx] Failed:', e);
    }
  };

  // 1. Check Allowance
  const allowanceQuery = useQuery({
    queryKey: ['allowance', fundManagerAddress, poolTokenAddress, wagmiAddress],
    queryFn: async () => {
      if (!fundManagerAddress || !poolTokenAddress || !wagmiAddress) return 0n;
      const token = getERC20Read(poolTokenAddress);
      return await token.allowance(wagmiAddress, fundManagerAddress);
    },
    enabled: !!fundManagerAddress && !!poolTokenAddress && !!wagmiAddress,
    refetchInterval: 5000,
  });

  // 2. Approve: string amounts + on-chain decimals only (never parseFloat totals — float noise breaks parseUnits).
  // Non-standard tokens that require approve(0) before changing allowance are not handled here; add only if your pool token needs it.
  const approve = useMutation({
    mutationFn: async ({ amount, fee = '0' }: { amount: string; fee?: string }) => {
      if (!isConnected || !wagmiAddress) throw new Error('Wallet not connected');
      if (!fundManagerAddress || !poolTokenAddress) throw new Error('Contract addresses missing');
      if (!isDecimalsReady) throw new Error('Token decimals are still loading. Please wait.');

      const decimals = await resolveDecimals(poolTokenAddress, decimalsQuery.data);
      const inputErr = getTokenDecimalInputError(amount, fee ?? '0', decimals);
      if (inputErr) throw new Error(inputErr);

      const tid = toast.loading('Waiting for MetaMask signature to approve...');
      try {
        const amountWei = parseUnits(amount || '0', decimals) + parseUnits(fee || '0', decimals);

        const token = await getERC20(poolTokenAddress);
        const tx = await token.approve(fundManagerAddress, amountWei);
        toast.loading('Approving tokens...', { id: tid });

        await tx.wait();
        toast.success('Tokens approved successfully!', { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: async () => {
      await allowanceQuery.refetch();
    },
  });

  // 3. Repay — AssetManager.pay
  const repay = useMutation({
    mutationFn: async ({ v1PoolId, amount, fee }: { v1PoolId: string; amount: string; fee: string }) => {
      if (!isConnected || !wagmiAddress) throw new Error('Wallet not connected');
      if (!fundManagerAddress) throw new Error('Asset Manager address missing');
      if (!isDecimalsReady) throw new Error('Token decimals are still loading. Please wait.');

      const decimals = await resolveDecimals(poolTokenAddress, decimalsQuery.data);
      const inputErr = getTokenDecimalInputError(amount, fee ?? '0', decimals);
      if (inputErr) throw new Error(inputErr);

      const tid = toast.loading('Waiting for MetaMask signature to confirm repayment...');
      try {
        const assetManager = await getAssetManager(fundManagerAddress);

        const amountWei = parseUnits(amount, decimals);
        const feeWei = parseUnits(fee || '0', decimals);

        const tx = await assetManager.pay(v1PoolId, amountWei, feeWei);
        toast.loading('Processing repayment...', { id: tid });

        await tx.wait();
        toast.success('Repayment confirmed!', { id: tid });

        try {
          await api.post('/pools/record-activity', {
            txHash: tx.hash,
            type: 'repay',
            amount: amountWei.toString(),
            poolId,
            tokenAddress: poolTokenAddress,
            toAddress: fundManagerAddress,
            status: 'confirmed',
          });
        } catch (e) {
          console.error('[Audit] Failed to record activity:', e);
        }
        await confirmTx(tx.hash, 'repay', poolId, v1PoolId);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'dashboard-active-pools'] });
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'my-pools'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
      await allowanceQuery.refetch();
    },
  });

  return {
    allowanceQuery,
    approve,
    repay,
    tokenDecimals: decimalsQuery.data ?? 6,
    isDecimalsReady,
    isDecimalsLoading,
  };
}
