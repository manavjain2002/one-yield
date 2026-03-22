import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge, RiskBadge } from '@/components/StatusBadge';
import { usePoolsList } from '@/hooks/usePools';
import { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Clock, Landmark, DollarSign, ChartLine, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { TransactModal } from '@/components/TransactModal';
import { AddressLink } from '@/components/AddressLink';
import type { Pool } from '@/data/mockData';

export default function LenderDashboard() {
  const { data: pools = [] } = usePoolsList();
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [transactPool, setTransactPool] = useState<Pool | null>(null);

  const platformTvl = pools.reduce((s, p) => s + p.totalReceived, 0);
  const platformInterest = pools.reduce((s, p) => s + (p.totalReceived * p.apy / 100 / 2), 0);
  const activePools = pools.filter(p => p.status === 'active' || p.status === 'paused').slice(0, 5);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Earn Opportunities</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Deploy capital into high-yield RWA pools</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-muted-foreground bg-secondary/30 px-4 py-2 rounded-full border border-border/50">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            LIVE MARKET DATA
          </div>
        </div>

        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ChartLine className="w-5 h-5 text-primary" />
                Market Statistics
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Total Value Locked" value={`$${Math.round(platformTvl).toLocaleString()}`} icon={<Landmark className="h-5 w-5" />} />
              <MetricCard title="Total Interest Paid" value={`$${Math.round(platformInterest).toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
              <MetricCard title="Avg Pool APR" value={pools.length > 0 ? `${(pools.reduce((s, p) => s + p.apy, 0) / pools.length).toFixed(1)}%` : '0%'} icon={<TrendingUp className="h-5 w-5 text-success" />} />
              <MetricCard title="Total Pools" value={String(pools.length)} icon={<TrendingUp className="h-5 w-5 text-success" />} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                <h2 className="text-xl font-bold">Top Yield Opportunities</h2>
              </div>
              <Link to="/lender/pools" className="text-sm font-bold text-primary hover:text-primary/80 transition-all flex items-center gap-1">
                Browse All Pools <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-4">
              {activePools.length > 0 ? (
                activePools.map(pool => {
                  const isExpanded = expandedPoolId === pool.id;
                  const nominalPoolSize = Number(pool.poolSize) / 1e6;
                  const actualFillPct = pool.totalRequested > 0 ? (pool.totalReceived / pool.totalRequested) * 100 : 0;

                  return (
                    <div key={pool.id} className="glass-card rounded-2xl overflow-hidden border border-border/40 transition-all hover:border-primary/20 group">
                      <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:flex-nowrap">
                        <div className="flex items-center gap-4 min-w-[200px]">
                          <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold shadow-inner group-hover:scale-110 transition-transform">
                            {pool.symbol[0]}
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">{pool.name}</h3>
                            <AddressLink address={pool.contractAddress} />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-10 flex-1 justify-evenly font-mono text-sm font-bold">
                          <div className="text-center sm:text-left min-w-[100px]">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5 opacity-70">Pool Size</p>
                            <p className="text-lg tracking-tighter">${nominalPoolSize.toLocaleString()}</p>
                          </div>
                          <div className="text-center sm:text-left min-w-[100px]">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5 opacity-70">Variable APY</p>
                            <p className="text-lg text-success tracking-tighter">{pool.apy}%</p>
                          </div>
                          <div className="text-center sm:text-left min-w-[100px]">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5 opacity-70">Risk Rating</p>
                            <RiskBadge level={pool.riskLevel} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                            className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-xl gradient-primary font-bold px-10 h-10 shadow-lg glow-primary hover:scale-105 active:scale-95 transition-all"
                            onClick={() => setTransactPool(pool)}
                            disabled={pool.status === 'paused'}
                          >
                            {pool.status === 'paused' ? 'Paused' : 'Transact'}
                          </Button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 border-t border-border/20 bg-primary/[0.02] animate-in slide-in-from-top-2 duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-4">
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pool Token</p>
                              <p className="text-sm font-bold">{pool.poolTokenName || 'USDC'}</p>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Token Address</p>
                              <AddressLink address={pool.poolTokenAddress || ''} />
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">LP Token</p>
                              <p className="text-sm font-bold">{pool.lpTokenName || `${pool.symbol} LP`}</p>
                            </div>
                            <div className="col-span-1 space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                <span className="text-muted-foreground">Liquidity Progress</span>
                                <span className="text-primary">{actualFillPct.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-secondary/40 border border-border/20 p-[1px]">
                                <div className="h-full rounded-full gradient-primary" style={{ width: `${Math.min(actualFillPct, 100)}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-24 text-center text-muted-foreground italic glass-card rounded-2xl border-dashed border-border/50 bg-secondary/10 flex flex-col items-center gap-2">
                  <Clock className="h-8 w-8 opacity-30" />
                  No active pools found.
                </div>
              )}
            </div>
          </div>
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
