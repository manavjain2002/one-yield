import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { getPoolFactory } from '@/lib/contracts';
import type { Pool } from '@/data/mockData';

export type AdminDraftBorrowerProfile = {
  username: string | null;
  walletAddress: string | null;
  displayName: string | null;
  email: string | null;
  country: string | null;
  role: string;
};

export type AdminPoolDraftDetail = {
  id: string;
  borrowerIdentifier: string;
  name: string;
  symbol: string;
  apyBasisPoints: number;
  poolSize: string;
  poolTokenAddress: string;
  poolManagerAddress: string;
  oracleManagerAddress: string;
  feeCollectorAddress: string;
  hasDocument: boolean;
  documentOriginalName: string | null;
  indexed: boolean;
  txHash: string | null;
  createdAt: string;
  /** Present when API returns enriched borrower profile; treat missing as unlinked. */
  borrower?: AdminDraftBorrowerProfile | null;
};

async function confirmFactoryTx(
  txHash: string,
  type: 'pause' | 'unpause' | 'close',
  poolId: string,
) {
  try {
    await api.post('/pools/confirm-tx', { txHash, type, poolId });
  } catch (e) {
    console.error('[confirm-tx]', e);
  }
}

export function useAdminPoolActions() {
  const queryClient = useQueryClient();

  const pauseTarget = useMutation({
    mutationFn: async (pool: Pool) => {
      const tid = toast.loading('Confirm pause in wallet...');
      try {
        if (!pool.contractAddress) throw new Error('Missing pool contract address');
        const factory = await getPoolFactory();
        const tx = await factory.pauseTarget(pool.contractAddress);
        toast.loading('Pausing pool...', { id: tid });
        await tx.wait();
        await confirmFactoryTx(tx.hash, 'pause', pool.id);
        toast.success('Pool paused via factory', { id: tid });
      } catch (e) {
        toast.error(getErrorMessage(e), { id: tid });
        throw e;
      }
    },
    onSuccess: (_data, pool) => {
      const addr = pool.contractAddress?.trim();
      if (addr) queryClient.setQueryData(['pool-paused', addr], true);
      void queryClient.invalidateQueries({ queryKey: ['pool-paused'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pools'] });
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
  });

  const unpauseTarget = useMutation({
    mutationFn: async (pool: Pool) => {
      const tid = toast.loading('Confirm unpause in wallet...');
      try {
        if (!pool.contractAddress) throw new Error('Missing pool contract address');
        const factory = await getPoolFactory();
        const tx = await factory.unpauseTarget(pool.contractAddress);
        toast.loading('Unpausing pool...', { id: tid });
        await tx.wait();
        await confirmFactoryTx(tx.hash, 'unpause', pool.id);
        toast.success('Pool unpaused via factory', { id: tid });
      } catch (e) {
        toast.error(getErrorMessage(e), { id: tid });
        throw e;
      }
    },
    onSuccess: (_data, pool) => {
      const addr = pool.contractAddress?.trim();
      if (addr) queryClient.setQueryData(['pool-paused', addr], false);
      void queryClient.invalidateQueries({ queryKey: ['pool-paused'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pools'] });
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
  });

  const closePoolFactory = useMutation({
    mutationFn: async (pool: Pool) => {
      const tid = toast.loading('Confirm close in wallet...');
      try {
        if (!pool.contractAddress) throw new Error('Missing pool contract address');
        const factory = await getPoolFactory();
        const tx = await factory.closePool(pool.contractAddress);
        toast.loading('Closing pool...', { id: tid });
        await tx.wait();
        await confirmFactoryTx(tx.hash, 'close', pool.id);
        toast.success('Pool closed via factory', { id: tid });
      } catch (e) {
        toast.error(getErrorMessage(e), { id: tid });
        throw e;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pool-paused'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pools'] });
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
    },
  });

  const createPoolFromDraft = useMutation({
    mutationFn: async (draft: AdminPoolDraftDetail) => {
      const tid = toast.loading('Confirm createPool in wallet...');
      try {
        const factory = await getPoolFactory();
        const tx = await factory.createPool(
          draft.name,
          draft.symbol,
          draft.poolManagerAddress,
          draft.poolTokenAddress,
          draft.oracleManagerAddress,
          draft.feeCollectorAddress,
          BigInt(draft.apyBasisPoints),
          BigInt(draft.poolSize),
        );
        toast.loading('Waiting for confirmation...', { id: tid });
        await tx.wait();
        await api.post('/pools/confirm-tx', {
          txHash: tx.hash,
          type: 'create_pool',
          draftId: draft.id,
        });
        toast.success('Pool created and indexed', { id: tid });
      } catch (e) {
        toast.error(getErrorMessage(e), { id: tid });
        throw e;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pool-paused'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pools'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pool-drafts'] });
      void queryClient.invalidateQueries({ queryKey: ['manager-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['pools'] });
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'dashboard-active-pools'] });
      void queryClient.invalidateQueries({ queryKey: ['borrower', 'my-pools'] });
    },
  });

  return {
    pauseTarget,
    unpauseTarget,
    closePoolFactory,
    createPoolFromDraft,
  };
}
