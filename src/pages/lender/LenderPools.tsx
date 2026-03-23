import { DashboardLayout } from '@/components/DashboardLayout';
import { RiskBadge, StatusBadge } from '@/components/StatusBadge';
import { usePoolsList } from '@/hooks/usePools';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { Pool } from '@/data/mockData';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TransactModal } from '@/components/TransactModal';
import { AddressLink } from '@/components/AddressLink';

export default function LenderPools() {
  const [transactPool, setTransactPool] = useState<Pool | null>(null);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const { data: pools = [] } = usePoolsList();
  
  const activePools = pools.filter(p => p.status === 'active' || p.status === 'paused');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Earn Opportunities</h1>
            <p className="text-sm text-muted-foreground mt-1">Deploy capital into verified RWA pools</p>
          </div>
        </div>

        <div className="space-y-3">
          {activePools.length > 0 ? (
            activePools.map(pool => {
              const isExpanded = expandedPoolId === pool.id;
              const fillPct = (pool.totalReceived / Number(pool.poolSize) * 1e6) * 100; // Corrected math if poolSize is nominal
              // Actually poolSize is raw string, so Number(pool.poolSize)/1e6 is nominal.
              // Let's use mapApiPoolToUi values if possible, but usePoolsList returns Pool[]
              const nominalPoolSize = Number(pool.poolSize) / 1e6;
              const actualFillPct = (pool.totalReceived / nominalPoolSize) * 100;

              return (
                <div key={pool.id} className="glass-card rounded-2xl overflow-hidden border border-border/40 transition-all hover:border-primary/20">
                  {/* Main Row */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:flex-nowrap">
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-inner">
                        {pool.symbol[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">{pool.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">{pool.contractAddress.slice(0, 6)}...{pool.contractAddress.slice(-4)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-8 flex-1 justify-center sm:justify-start font-mono">
                      <div className="text-center sm:text-left min-w-[80px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">Pool Size</p>
                        <p className="text-sm font-bold text-foreground">${nominalPoolSize.toLocaleString()}M</p>
                      </div>
                      <div className="text-center sm:text-left min-w-[60px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">APR</p>
                        <p className="text-sm font-bold text-success">{pool.apy}%</p>
                      </div>
                      <div className="text-center sm:text-left min-w-[80px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">Risk</p>
                        <RiskBadge level={pool.riskLevel} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                        className="rounded-xl flex-1 sm:flex-none text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                        Details
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setTransactPool(pool)}
                        className="flex-1 sm:flex-none rounded-xl gradient-primary font-bold px-8 shadow-md glow-primary transition-all active:scale-95"
                        disabled={pool.status === 'paused'}
                      >
                        {pool.status === 'paused' ? 'Paused' : 'Transact'}
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-border/20 bg-primary/[0.02] animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">LP Token Name</p>
                          <p className="text-xs font-bold text-foreground/80">{pool.lpTokenName || `OneYield ${pool.symbol} LP`}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">LP Token Address</p>
                          <AddressLink address={pool.lpTokenAddress || pool.contractAddress} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Address</p>
                          <AddressLink address={pool.contractAddress} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Token</p>
                          <p className="text-xs font-bold text-foreground/80">{pool.poolTokenName || 'USDC'}</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-border/10">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider mb-2">
                          <span className="text-muted-foreground">Pool Liquidity Progress</span>
                          <span className="text-primary">{actualFillPct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary/30">
                          <div className="h-full rounded-full gradient-primary shadow-[0_0_10px_rgba(139,92,246,0.2)] transition-all duration-1000" style={{ width: `${actualFillPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center text-muted-foreground italic glass-card rounded-2xl border-dashed border-border/50">
              No active pools found for investment.
            </div>
          )}
        </div>
      </div>

      {transactPool && (
        <TransactModal
          isOpen={!!transactPool}
          onClose={() => setTransactPool(null)}
          pool={transactPool}
        />
      )}
    </DashboardLayout>
  );
}
