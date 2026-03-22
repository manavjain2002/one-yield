import { useState } from 'react';
import type { Pool } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useManagerActions } from '@/hooks/useManagerActions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getAssetManagerRead } from '@/lib/contracts';
import { useTransaction } from '@/contexts/TransactionContext';
import { AlertTriangle, Plus, Trash2, RefreshCw, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type BorrowerWallet = { id: string; walletAddress: string; tokenAddress: string; borrowerIdentifier: string };

export function ChildPoolsManager({ pool }: { pool: Pool }) {
  const actions = useManagerActions();
  const queryClient = useQueryClient();
  const { startTransaction, endTransaction } = useTransaction();
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});

  // --- Fetch borrower wallets for the pool's accepted token ---
  const { data: borrowerWallets = [] } = useQuery({
    queryKey: ['pool-borrower-wallets', pool.id],
    queryFn: async () => {
      const { data } = await api.get<BorrowerWallet[]>(`/pools/${pool.id}/borrower-wallets`);
      return data;
    },
    enabled: !!pool.id,
  });

  // --- Read on-chain pools via poolCount() + v1Pools(i) ---
  const { data: onChainPools = [], refetch: refetchOnChain } = useQuery({
    queryKey: ['on-chain-pools', pool.fundManagerAddress, pool.id],
  
    queryFn: async () => {
      const fm = getAssetManagerRead(pool.fundManagerAddress);
      const count = await fm.totalV1Pools();
      const pools = [];
      for (let i = 0; i < Number(count); i++) {
        const result = await fm.v1Pools(i);
        const wallet = await fm.dedicatedWallet(result.v1PoolId);
  
        pools.push({
          index: i,
          v1PoolId: result.v1PoolId || result[0],
          allocation: Number(result.allocation || result[1]),
          wallet,
        });
      }
  
      return pools;
    },
  
    enabled: !!pool.fundManagerAddress,
  
    // 🔥 important settings
    staleTime: 5000,              // avoid spamming RPC
    refetchOnWindowFocus: false,  // optional
  });
  // const { data: onChainPools = [], refetch: refetchOnChain } = useQuery({
  //   queryKey: ['on-chain-pools', pool.fundManagerAddress],
  //   queryFn: async () => {
  //     if (!pool.fundManagerAddress) return [];
  //     const fm = getAssetManagerRead(pool.fundManagerAddress);
  //     const count = await fm.totalV1Pools();
  //     console.log('count', count);
  //     const n = Number(count);
  //     const pools: { index: number; v1PoolId: string; allocation: number; wallet: string }[] = [];
  //     for (let i = 0; i < n; i++) {
  //       try {
  //         const result = await fm.v1Pools(i);
  //         console.log('result', result);
  //         pools.push({
  //           index: i,
  //           v1PoolId: result.v1PoolId || result[0],
  //           allocation: Number(result.allocation || result[1]),
  //           wallet: result.wallet || result[2],
  //         });
  //       } catch (error) {
  //         console.error('Error fetching v1Pool', error);
  //       }
  //     }
  //     return pools;
  //   },
  //   enabled: !!pool.fundManagerAddress,
  //   refetchInterval: 15000,
  //   staleTime: 0,
  // });

  // --- Read totalAllocation() from on-chain (basis points, 10000 = 100%) ---
  const { data: totalAllocationOnChain = 0 } = useQuery({
    queryKey: ['total-allocation', pool.fundManagerAddress],
    queryFn: async () => {
      if (!pool.fundManagerAddress) return 0;
      const fm = getAssetManagerRead(pool.fundManagerAddress);
      const val = await fm.totalAllocation();
      return Number(val);
    },
    enabled: !!pool.fundManagerAddress,
    refetchInterval: 15000,
  });

  const isAllocationComplete = totalAllocationOnChain === 10000;

  const refetchAll = () => {
    void refetchOnChain();
    void queryClient.invalidateQueries({ queryKey: ['on-chain-pools', pool.fundManagerAddress] });
    void queryClient.invalidateQueries({ queryKey: ['total-allocation', pool.fundManagerAddress] });
    void queryClient.invalidateQueries({ queryKey: ['pool-borrower-wallets', pool.id] });
  };

  // --- Match borrower wallets against on-chain pools ---
  const onChainWalletSet = new Set(onChainPools.map(p => p.wallet.toLowerCase()));
  const unmatchedWallets = borrowerWallets.filter(
    bw => !onChainWalletSet.has(bw.walletAddress.toLowerCase()),
  );
  // --- Handlers ---
  const handleAdd = async (walletAddress: string) => {
    const allocationVal = parseInt(allocationInputs[walletAddress] || '0');
    if (!allocationVal) return;
    const v1PoolId = `v1-${Date.now()}`;

    startTransaction('Adding child pool...');
    try {
      await actions.addChildPool.mutateAsync({ pool, v1PoolId, wallet: walletAddress, allocationVal: allocationVal * 100 });
      refetchAll();
    } finally {
      endTransaction();
    }
  };

  const handleRemove = async (index: number) => {
    startTransaction('Removing child pool...');
    try {
      await actions.removeChildPool.mutateAsync({ pool, index });
      refetchAll();
    } finally {
      endTransaction();
    }
  };

  const handleUpdateAllocation = async (index: number, walletAddr: string) => {
    const val = allocationInputs[walletAddr];
    if (!val || isNaN(Number(val))) return;
    const bps = Number(val) * 100;

    startTransaction('Updating allocation...');
    try {
      await actions.updateChildAllocation.mutateAsync({ pool, index, allocation: bps });
      refetchAll();
    } finally {
      endTransaction();
    }
  };

  const shorten = (addr: string) => `${addr.slice(0, 8)}…${addr.slice(-6)}`;

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Child Pools / Wallet Allocations</h3>
          <p className="text-sm text-muted-foreground">
            Manage borrower wallet allocations for fund deployment
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                  isAllocationComplete
                    ? 'bg-success/10 text-success'
                    : 'bg-warning/10 text-warning'
                }`}
              >
                {isAllocationComplete ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                On-chain: {totalAllocationOnChain / 100}%
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {isAllocationComplete
                ? 'Allocations sum to 100% — ready to deploy'
                : `Allocations sum to ${totalAllocationOnChain / 100}% — must be exactly 100% to deploy`}
            </TooltipContent>
          </Tooltip>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={refetchAll}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Warning banner */}
      {!isAllocationComplete && onChainPools.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            Allocations must total 100% before deploying funds. Current:{' '}
            {totalAllocationOnChain / 100}%. Deploy Funds will be disabled until allocations are
            correct.
          </span>
        </div>
      )}

      {/* On-chain configured pools */}
      {onChainPools.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Configured On-Chain Pools
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Wallet</th>
                  <th className="py-3 px-4">Current %</th>
                  <th className="py-3 px-4">New Allocation %</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {onChainPools.map(cp => (
                  <tr key={cp.index} className="hover:bg-secondary/5 transition-colors">
                    <td className="py-3 px-4 text-xs text-muted-foreground">{cp.index}</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">{shorten(cp.wallet)}</span>
                        </TooltipTrigger>
                        <TooltipContent className="font-mono text-xs">{cp.wallet}</TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="py-3 px-4 text-xs font-bold">{cp.allocation / 100}%</td>
                    <td className="py-3 px-4 w-40">
                      <Input
                        placeholder="e.g. 50"
                        type="number"
                        className="h-8 text-xs bg-secondary/30 border-border w-24"
                        value={allocationInputs[cp.wallet] || ''}
                        onChange={e =>
                          setAllocationInputs(s => ({ ...s, [cp.wallet]: e.target.value }))
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs px-3 hover:bg-primary/20 hover:text-primary transition-colors"
                          disabled={!allocationInputs[cp.wallet]}
                          onClick={() => handleUpdateAllocation(cp.index, cp.wallet)}
                        >
                          Update
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[10px] border-destructive/50 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemove(cp.index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {onChainPools.length === 0 && borrowerWallets.length > 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <p>No child pools configured on-chain yet.</p>
          <p className="text-xs mt-1">Add borrower wallets below to create allocations.</p>
        </div>
      )}

      {/* Unmatched borrower wallets (not yet on-chain) */}
      {unmatchedWallets.length > 0 && (
        <div className="border-t border-border/30 pt-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 mb-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">Action Required</p>
              <p className="text-xs text-muted-foreground">
                Add these wallets to on-chain allocations below. Enter allocation % and click + to configure each wallet before deploying funds.
              </p>
            </div>
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Wallets to Add (enter % and click +)
          </p>
          <div className="space-y-2">
            {unmatchedWallets.map(bw => (
              <div
                key={bw.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-secondary/10 border border-border/30"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono text-xs cursor-default flex-shrink-0">
                      {shorten(bw.walletAddress)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="font-mono text-xs">
                    {bw.walletAddress}
                  </TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {bw.tokenAddress.slice(0, 8)}…
                </span>
                <Input
                  placeholder="Allocation %"
                  type="number"
                  className="h-8 text-xs bg-secondary/30 border-border w-28"
                  value={allocationInputs[bw.walletAddress] || ''}
                  onChange={e =>
                    setAllocationInputs(s => ({ ...s, [bw.walletAddress]: e.target.value }))
                  }
                />
                <Button
                  size="sm"
                  className="h-8 px-3 gradient-primary font-bold rounded-xl"
                  disabled={!allocationInputs[bw.walletAddress]}
                  onClick={() => handleAdd(bw.walletAddress)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No borrower wallets at all */}
      {borrowerWallets.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No borrower wallets configured for this pool's token.</p>
          <p className="text-xs mt-1">
            Ask the borrower to register a dedicated wallet for this pool's accepted token.
          </p>
        </div>
      )}
    </div>
  );
}
