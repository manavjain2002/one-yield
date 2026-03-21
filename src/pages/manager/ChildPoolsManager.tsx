import { useState } from 'react';
import type { Pool } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useManagerActions } from '@/hooks/useManagerActions';

export function ChildPoolsManager({ pool }: { pool: Pool }) {
  const actions = useManagerActions();
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});
  const [walletInputs, setWalletInputs] = useState<Record<string, string>>({});
  
  const childPools = pool.borrowerPools || [];

  if (childPools.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 mb-8 text-center text-muted-foreground border border-dashed border-border py-12">
        <p>No verified child pools (borrower allocations) exist for this V2 Pool yet.</p>
        <p className="text-xs mt-2">Borrowers must initiate a borrow request against this Asset Manager first.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 mb-8 border-l-4 border-l-primary/50">
      <h3 className="text-lg font-bold mb-1">Child Pools Allocation Strategy</h3>
      <p className="text-sm text-muted-foreground mb-6">Manage allocations and physically dedicated wallets for verified V1 Borrower child pools.</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-white/10 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="py-3 px-4">Borrower V1 Pool ID</th>
              <th className="py-3 px-4">Target Allocation %</th>
              <th className="py-3 px-4">Dedicated Wallet</th>
              <th className="py-3 px-4 text-right">Actions (On-Chain)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {childPools.map((cp, idx) => {
              const v1PoolId = cp.v1PoolId || `v1pool-${idx}`;
              return (
                <tr key={v1PoolId} className="group hover:bg-white/[0.02]">
                  <td className="py-4 px-4 font-mono text-xs">{v1PoolId}</td>
                  
                  <td className="py-4 px-4 w-40">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="e.g. 50" 
                        className="h-8 text-xs bg-secondary/50 border-border"
                        value={allocationInputs[v1PoolId] || ''}
                        onChange={(e) => setAllocationInputs(s => ({ ...s, [v1PoolId]: e.target.value }))}
                      />
                      <Button 
                        size="sm" 
                        className="h-8 text-xs px-2"
                        variant="secondary"
                        disabled={actions.updateChildAllocation.isPending}
                        onClick={() => {
                          const val = allocationInputs[v1PoolId];
                          if (!val || isNaN(Number(val))) return;
                          // Allocation on contract is basis points or raw basis points handling, assuming raw number % for mock
                          actions.updateChildAllocation.mutate({ pool, v1PoolId, allocation: Number(val) * 100 });
                        }}
                      >
                        Set
                      </Button>
                    </div>
                  </td>

                  <td className="py-4 px-4 w-60">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="0x..." 
                        className="h-8 text-xs bg-secondary/50 border-border font-mono break-all"
                        defaultValue={cp.dedicatedWalletAddress}
                        onChange={(e) => setWalletInputs(s => ({ ...s, [v1PoolId]: e.target.value }))}
                      />
                      <Button 
                        size="sm" 
                        className="h-8 text-xs px-2"
                        variant="secondary"
                        disabled={actions.updateChildWallet.isPending}
                        onClick={() => {
                          const w = walletInputs[v1PoolId] || cp.dedicatedWalletAddress;
                          if (!w) return;
                          actions.updateChildWallet.mutate({ pool, v1PoolId, wallet: w });
                        }}
                      >
                        Update
                      </Button>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-right space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-8 text-[10px] border-primary/50 text-primary hover:bg-primary/10"
                      disabled={actions.addChildPool.isPending}
                      onClick={() => {
                        const w = walletInputs[v1PoolId] || cp.dedicatedWalletAddress;
                        actions.addChildPool.mutate({ pool, v1PoolId, wallet: w });
                      }}
                    >
                      Add to Manager
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-8 text-[10px] border-destructive/50 text-destructive hover:bg-destructive/10"
                      disabled={actions.removeChildPool.isPending}
                      onClick={() => {
                        actions.removeChildPool.mutate({ pool, v1PoolId });
                      }}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
