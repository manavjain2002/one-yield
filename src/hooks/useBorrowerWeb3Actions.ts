import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAccount } from 'wagmi';
import { parseUnits } from 'ethers';
import { getERC20, getERC20Read, getAssetManager } from '@/lib/contracts';
import { api, getErrorMessage } from '@/lib/api';

interface UseBorrowerWeb3ActionsProps {
  poolTokenAddress: string;
  fundManagerAddress: string;
  poolId: string;
}

export function useBorrowerWeb3Actions({ poolTokenAddress, fundManagerAddress, poolId }: UseBorrowerWeb3ActionsProps) {
  const { address: wagmiAddress, isConnected } = useAccount();
  const queryClient = useQueryClient();

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

  // 2. Approve Token Mapping
  const approve = useMutation({
    mutationFn: async (amountHuman: string) => {
      if (!isConnected || !wagmiAddress) throw new Error('Wallet not connected');
      if (!fundManagerAddress || !poolTokenAddress) throw new Error('Contract addresses missing');
      
      const tid = toast.loading('Waiting for MetaMask signature to approve...');
      try {
        const token = await getERC20(poolTokenAddress);
        const amountWei = parseUnits(amountHuman, 6); // Assuming USDC 6 decimals
        
        const tx = await token.approve(fundManagerAddress, amountWei);
        toast.loading('Approving tokens...', { id: tid });
        
        await tx.wait();
        toast.success('Tokens approved successfully!', { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void allowanceQuery.refetch();
    },
  });

  // 3. Repay Function (Calls 'pay' on AssetManager)
  const repay = useMutation({
    mutationFn: async ({ v1PoolId, amount, fee }: { v1PoolId: string; amount: string; fee: string }) => {
      if (!isConnected || !wagmiAddress) throw new Error('Wallet not connected');
      if (!fundManagerAddress) throw new Error('Asset Manager address missing');

      const tid = toast.loading('Waiting for MetaMask signature to confirm repayment...');
      try {
        const assetManager = await getAssetManager(fundManagerAddress);
        
        const amountWei = parseUnits(amount, 6);
        const feeWei = parseUnits(fee || '0', 6);

        // payload: pay(string _v1PoolId, uint256 _amount, uint256 _fee)
        const tx = await assetManager.pay(v1PoolId, amountWei, feeWei);
        toast.loading('Processing repayment...', { id: tid });
        
        await tx.wait();
        toast.success('Repayment confirmed!', { id: tid });

        // Optional: Call backend to record this tx
        try {
          await api.post('/pools/record-activity', {
            txHash: tx.hash,
            type: 'repay',
            amount: amountWei.toString(),
            poolId,
            tokenAddress: poolTokenAddress,
            toAddress: fundManagerAddress,
          });
        } catch (e) {
          console.error('[Audit] Failed to record activity:', e);
        }

      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'pools'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
      void allowanceQuery.refetch();
    },
  });

  return {
    allowanceQuery,
    approve,
    repay,
  };
}
