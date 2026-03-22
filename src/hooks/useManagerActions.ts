import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { getLendingPool, getPoolFactory, getAssetManager } from '@/lib/contracts';
import { parseUnits } from 'ethers';
import type { Pool } from '@/data/mockData';

export function useManagerActions() {
  const queryClient = useQueryClient();

  const recordTx = async (pool: Pool, txHash: string, type: string, amount: string) => {
    try {
      await api.post('/pools/record-activity', {
        txHash,
        type,
        amount: parseUnits(amount, 6).toString(),
        poolId: pool.id,
        tokenAddress: pool.poolTokenAddress,
        toAddress: pool.contractAddress,
        status: 'confirmed',
      });
    } catch (e) {
      console.error('[Audit] Failed to record manager action:', e);
    }
  };

  const confirmTx = async (txHash: string, type: string, poolId?: string) => {
    try {
      await api.post('/pools/confirm-tx', { txHash, type, poolId });
    } catch (e) {
      console.error('[ConfirmTx] Failed:', e);
    }
  };

  // Activate Pool
  const activatePool = useMutation({
    mutationFn: async (pool: Pool) => {
      const tid = toast.loading('Waiting for MetaMask signature to activate pool...');
      try {
        if (!pool.contractAddress) throw new Error('Pool contract address not found. Waiting for indexer?');
        const contract = await getLendingPool(pool.contractAddress);
        const tx = await contract.activatePool();
        toast.loading('Activating pool...', { id: tid });
        await tx.wait();
        toast.success(`Pool ${pool.name} activated successfully!`, { id: tid });
        await confirmTx(tx.hash, 'activate', pool.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
    },
  });

  // Pause Pool (direct contract call)
  const pausePool = useMutation({
    mutationFn: async (pool: Pool) => {
      const tid = toast.loading('Waiting for MetaMask signature to pause pool...');
      try {
        if (!pool.contractAddress) throw new Error('Pool contract address not found.');
        const contract = await getLendingPool(pool.contractAddress);
        const tx = await contract.pause();
        toast.loading('Pausing pool...', { id: tid });
        await tx.wait();
        toast.success(`Pool ${pool.name} paused successfully!`, { id: tid });
        await confirmTx(tx.hash, 'pause', pool.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
    },
  });

  // Unpause Pool (direct contract call)
  const unpausePool = useMutation({
    mutationFn: async (pool: Pool) => {
      const tid = toast.loading('Waiting for MetaMask signature to unpause pool...');
      try {
        if (!pool.contractAddress) throw new Error('Pool contract address not found.');
        const contract = await getLendingPool(pool.contractAddress);
        const tx = await contract.unpause();
        toast.loading('Unpausing pool...', { id: tid });
        await tx.wait();
        toast.success(`Pool ${pool.name} unpaused successfully!`, { id: tid });
        await confirmTx(tx.hash, 'unpause', pool.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
    },
  });

  // Close Pool (direct contract call)
  const closePool = useMutation({
    mutationFn: async (pool: Pool) => {
      const tid = toast.loading('Waiting for MetaMask signature to close pool...');
      try {
        if (!pool.contractAddress) throw new Error('Pool contract address not found.');
        const contract = await getLendingPool(pool.contractAddress);
        const tx = await contract.close();
        toast.loading('Closing pool...', { id: tid });
        await tx.wait();
        toast.success(`Pool ${pool.name} closed successfully!`, { id: tid });
        await confirmTx(tx.hash, 'close', pool.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
    },
  });

  // 1. Pool -> Fund Manager (Sweep idle cash)
  const sweepToFundManager = useMutation({
    mutationFn: async ({ pool, amount }: { pool: Pool, amount: bigint }) => {
      const tid = toast.loading('Waiting for MetaMask signature to sweep funds to Manager...');
      try {
        if (!pool.contractAddress) throw new Error('Pool contract address missing.');
        const contract = await getLendingPool(pool.contractAddress);
        const tx = await contract.sendReserveToAssetManager(amount, { gasLimit: 500_000 });
        toast.loading('Sweeping funds...', { id: tid });

        const amtStr = (Number(amount) / 1e6).toString();
        await recordTx(pool, tx.hash, 'transfer', amtStr);

        await tx.wait();
        toast.success(`Successfully swept $${Number(amtStr).toLocaleString()} to Fund Manager!`, { id: tid });
        await confirmTx(tx.hash, 'sweep', pool.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pool-onchain'] });
    },
  });

  // 2. Fund Manager -> Pool (Refill for withdrawals)
  const refillPool = useMutation({
    mutationFn: async ({ pool, amount }: { pool: Pool, amount: bigint }) => {
      const tid = toast.loading('Waiting for MetaMask signature to refill pool...');
      try {
        if (!pool.fundManagerAddress) throw new Error('Fund Manager address missing.');
        const fm = await getAssetManager(pool.fundManagerAddress);
        // Using sendToReserve(amount, uptoQueuePosition)
        const tx = await fm.sendToReserve(amount, { gasLimit: 500_000 });
        toast.loading('Refilling pool...', { id: tid });

        const amtStr = (Number(amount) / 1e6).toString();
        await recordTx(pool, tx.hash, 'refill', amtStr);

        await tx.wait();
        toast.success(`Successfully refilled pool with $${Number(amtStr).toLocaleString()}!`, { id: tid });
        await confirmTx(tx.hash, 'refill', pool.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pool-onchain'] });
    },
  });

  // 3. Fund Manager -> Borrowers (Release/Deploy capital)
  const releaseToBorrowers = useMutation({
    mutationFn: async (pool: Pool) => {
      const tid = toast.loading('Waiting for MetaMask signature to release funds to borrowers...');
      try {
        if (!pool.fundManagerAddress) throw new Error('Fund Manager address missing.');
        const fm = await getAssetManager(pool.fundManagerAddress);
        const tx = await fm.deployFunds({ gasLimit: 500_000 });
        toast.loading('Releasing funds...', { id: tid });

        // AUM is what's being released. amount in recordTx is in dollars.
        const amtStr = (Number(pool.assetUnderManagement) / 1e6).toString();
        await recordTx(pool, tx.hash, 'deploy', amtStr);

        await tx.wait();
        toast.success('Funds released to borrower sub-pools successfully!', { id: tid });
        await confirmTx(tx.hash, 'deploy_funds', pool.id);
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pool-onchain'] });
    },
  });

  // 4. Manage Child Pools
  const addChildPool = useMutation({
    mutationFn: async ({ pool, v1PoolId, wallet, allocationVal }: { pool: Pool, v1PoolId: string, wallet: string, allocationVal: number }) => {
      const tid = toast.loading('Waiting for MetaMask signature to add child pool...');
      try {
        if (!pool.fundManagerAddress) throw new Error('Fund Manager address missing.');
        const fm = await getAssetManager(pool.fundManagerAddress);
        console.log('wallet', wallet);
        const tx = await fm.addPool(v1PoolId, allocationVal, wallet);
        toast.loading('Adding child pool...', { id: tid });
        await tx.wait();
        toast.success(`Child pool ${v1PoolId} added successfully!`, { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
  });

  const removeChildPool = useMutation({
    mutationFn: async ({ pool, index }: { pool: Pool, index: number }) => {
      const tid = toast.loading('Waiting for MetaMask signature to remove child pool...');
      try {
        const fm = await getAssetManager(pool.fundManagerAddress);
        const tx = await fm.removePool(index);
        toast.loading('Removing child pool...', { id: tid });
        await tx.wait();
        toast.success(`Child pool removed successfully!`, { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
  });

  const updateChildAllocation = useMutation({
    mutationFn: async ({ pool, index, allocation }: { pool: Pool, index: number, allocation: number }) => {
      const tid = toast.loading('Waiting for MetaMask signature to set allocation...');
      try {
        const fm = await getAssetManager(pool.fundManagerAddress);
        const tx = await fm.updatePoolAllocation(index, allocation);
        toast.loading('Setting allocation...', { id: tid });
        await tx.wait();
        toast.success(`Allocation updated successfully!`, { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
  });

  const updateChildWallet = useMutation({
    mutationFn: async ({ pool, v1PoolId, wallet }: { pool: Pool, v1PoolId: string, wallet: string }) => {
      const tid = toast.loading('Waiting for MetaMask signature to update wallet...');
      try {
        const fm = await getAssetManager(pool.fundManagerAddress);
        const tx = await fm.updatePoolWallet(v1PoolId, wallet);
        toast.loading('Updating wallet...', { id: tid });
        await tx.wait();
        toast.success(`Wallet updated successfully!`, { id: tid });
      } catch (err) {
        toast.error(getErrorMessage(err), { id: tid });
        throw err;
      }
    },
  });

  return {
    activatePool,
    pausePool,
    unpausePool,
    closePool,
    sweepToFundManager,
    refillPool,
    releaseToBorrowers,
    addChildPool,
    removeChildPool,
    updateChildAllocation,
    updateChildWallet,
  };
}
