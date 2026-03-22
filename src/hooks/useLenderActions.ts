import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePoolContractPaused } from '@/hooks/usePoolContractPaused';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { getLendingPool, getERC20, getERC20Read, getLendingPoolRead } from '@/lib/contracts';
import { parseUnits, formatUnits } from 'ethers';
import type { Pool } from '@/data/mockData';
import { useWallet } from '@/contexts/WalletContext';

export function useLenderActions(pool: Pool | null) {
  const queryClient = useQueryClient();

  const { address } = useWallet();

  const invalidatePoolDashboardQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ['pools'] });
    void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['pool-balances'] });
    void queryClient.invalidateQueries({ queryKey: ['pool-onchain'] });
  };

  // Check Allowance
  const allowanceQuery = useQuery({
    queryKey: ['allowance', pool?.contractAddress, pool?.poolTokenAddress, address],
    queryFn: async () => {
      if (!pool?.contractAddress || !pool?.poolTokenAddress || !address) return 0n;
      const token = getERC20Read(pool.poolTokenAddress);
      return await token.allowance(address, pool.contractAddress);
    },
    enabled: !!pool && !!address,
  });

  const pausedQuery = usePoolContractPaused(pool?.contractAddress);

  // Check Max Withdraw/Redeem
  const limitsQuery = useQuery({
    queryKey: ['pool-limits', pool?.contractAddress, address],
    queryFn: async () => {
      if (!pool?.contractAddress || !address) return { maxWithdraw: 0n, maxRedeem: 0n };
      const contract = getLendingPoolRead(pool.contractAddress);
      const erc20Contract = getERC20Read(pool.lpTokenAddress);
      try {
        const [mw, mr, ab] = await Promise.all([
          contract.maxWithdraw(address).catch(() => 0n),
          contract.maxRedeem(address).catch(() => 0n),
          erc20Contract.balanceOf(address).catch(() => 0n),
        ]);
        console.log("🚀 ~ useLenderActions ~ ab:", ab)
        console.log("🚀 ~ useLenderActions ~ mr:", mr)
        console.log("🚀 ~ useLenderActions ~ mw:", mw)
        return { maxWithdraw: mw > ab ? ab : mw, maxRedeem: mr };
      } catch (e) {
        return { maxWithdraw: 0n, maxRedeem: 0n };
      }
    },
    enabled: !!pool?.contractAddress && !!address,
  });

  const recordTx = async (txHash: string, type: string, amount: string) => {
    try {
      await api.post('/pools/record-activity', {
        txHash,
        type,
        amount: parseUnits(amount, 6).toString(),
        poolId: pool?.id,
        tokenAddress: pool?.poolTokenAddress,
        toAddress: pool?.contractAddress,
        status: 'confirmed',
      });
    } catch (e) {
      console.error('[Audit] Failed to record activity:', e);
    }
  };

  const confirmTx = async (txHash: string, type: string, poolId?: string) => {
    try {
      await api.post('/pools/confirm-tx', { txHash, type, poolId });
    } catch (e) {
      console.error('[ConfirmTx] Failed:', e);
    }
  };

  // Approve
  const approve = useMutation({
    mutationFn: async (amount: string) => {
      const tid = toast.loading('Waiting for MetaMask signature to approve USDC...');
      try {
        if (!pool?.contractAddress || !pool?.poolTokenAddress) throw new Error('Contract info missing');
        const token = await getERC20(pool.poolTokenAddress);
        const tx = await token.approve(pool.contractAddress, parseUnits(amount, 6));
        toast.loading('Approving USDC...', { id: tid });
        await recordTx(tx.hash, 'transfer', amount);
        await tx.wait();
        toast.success('USDC approved successfully!', { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void allowanceQuery.refetch();
    },
  });

  // Deposit
  const deposit = useMutation({
    mutationFn: async (amount: string) => {
      const tid = toast.loading('Waiting for MetaMask signature to deposit...');
      try {
        if (!pool?.contractAddress || !address) throw new Error('Contract info missing');
        if (pausedQuery.data) throw new Error('Pool is currently paused by the manager.');

        const contract = await getLendingPool(pool.contractAddress);
        const tx = await contract.deposit(parseUnits(amount, 6), address);
        toast.loading('Depositing...', { id: tid });

        // Proactively report to audit log
        await recordTx(tx.hash, 'deposit', amount);

        await tx.wait();
        toast.success(`Success! Deposited $${amount} into ${pool.name}`, { id: tid });
        await confirmTx(tx.hash, 'deposit', pool?.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      invalidatePoolDashboardQueries();
      void queryClient.invalidateQueries({ queryKey: ['lender-positions'] });
    },
  });

  // Withdraw (assets)
  const withdraw = useMutation({
    mutationFn: async (amount: string) => {
      const tid = toast.loading('Waiting for MetaMask signature to withdraw...');
      try {
        if (!pool?.contractAddress || !address) throw new Error('Contract info missing');
        if (pausedQuery.data) throw new Error('Pool is currently paused. Withdrawals are disabled.');

        const amountUnits = parseUnits(amount, 6);
        const maxW = limitsQuery.data?.maxWithdraw ?? 0n;

        if (amountUnits > maxW) {
          const maxStr = formatUnits(maxW, 6);
          throw new Error(`Insufficient liquid funds or limit exceeded. Max: $${maxStr}`);
        }

        const contract = await getLendingPool(pool.contractAddress);
        const tx = await contract.withdraw(amountUnits, address, address);
        toast.loading('Withdrawing USDC...', { id: tid });

        await recordTx(tx.hash, 'withdraw', amount);

        await tx.wait();
        toast.success(`Success! Withdrawn $${amount}`, { id: tid });
        await confirmTx(tx.hash, 'withdraw', pool?.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      invalidatePoolDashboardQueries();
      void queryClient.invalidateQueries({ queryKey: ['lender-positions'] });
      void queryClient.invalidateQueries({ queryKey: ['pool-limits'] });
    },
  });

  // Redeem (shares)
  const redeem = useMutation({
    mutationFn: async (shares: string) => {
      const tid = toast.loading('Waiting for MetaMask signature to redeem LP tokens...');
      try {
        if (!pool?.contractAddress || !address) throw new Error('Contract info missing');
        const contract = await getLendingPool(pool.contractAddress);
        const tx = await contract.redeem(parseUnits(shares, 6), address, address);
        toast.loading('Redeeming LP tokens...', { id: tid });

        await recordTx(tx.hash, 'withdraw', shares);

        await tx.wait();
        toast.success(`Success! Redeemed ${shares} LP tokens`, { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      invalidatePoolDashboardQueries();
      void queryClient.invalidateQueries({ queryKey: ['lender-positions'] });
      void queryClient.invalidateQueries({ queryKey: ['pool-limits'] });
    },
  });

  return {
    address,
    allowance: allowanceQuery.data ?? 0n,
    isPaused: pausedQuery.data ?? false,
    maxWithdraw: limitsQuery.data?.maxWithdraw ?? 0n,
    maxRedeem: limitsQuery.data?.maxRedeem ?? 0n,
    isLoadingLimits: limitsQuery.isFetching,
    isRefetchingAllowance: allowanceQuery.isFetching,
    approve,
    deposit,
    withdraw,
    redeem,
  };
}
