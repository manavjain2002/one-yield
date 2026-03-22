import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useManagerSummary } from '@/hooks/useManagerSummary';
import { AddressLink } from '@/components/AddressLink';
import { Landmark, Clock, BarChart3, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TransactionList } from '@/components/TransactionList';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ManagerDashboard() {
  const { data: summary } = useManagerSummary();
  const { data: txData, isLoading: isLoadingTxs } = useTransactionHistory(1, 5);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  const pools = summary?.poolsUi ?? [];
  const activePools = pools.filter(p => p.status === 'active');
  const pendingPools = pools.filter(p => p.status === 'pending');
  const collectivePoolSize = activePools.reduce((s, p) => s + Number(p.poolSize || '0') / 1e6, 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Pool Manager Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Oversee pool operations and fund flows</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Total Active Pools" value={String(activePools.length)} icon={<BarChart3 className="h-5 w-5 text-success" />} />
          <MetricCard title="Total Pending Pools" value={String(pendingPools.length)} icon={<Clock className="h-5 w-5 text-warning" />} />
          <MetricCard title="Collective Pool Size (Active)" value={`$${collectivePoolSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Landmark className="h-5 w-5" />} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Managed Pools
            </h2>
            <Link to="/manager/pools" className="text-sm font-medium text-primary hover:underline">
              Operations Center →
            </Link>
          </div>

          <div className="space-y-3">
            {pools.length > 0 ? (
              pools.map(pool => {
                const isExpanded = expandedPoolId === pool.id;
                return (
                  <div key={pool.id} className="glass-card rounded-2xl overflow-hidden border border-border/40 transition-all hover:border-primary/20">
                    <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:flex-nowrap">
                      <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                          {pool.symbol[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">{pool.name}</h3>
                          <AddressLink address={pool.contractAddress} />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-8 flex-1 justify-center sm:justify-start">
                        <div className="text-center sm:text-left min-w-[80px]">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">Pool Size</p>
                          <p className="text-sm font-bold text-foreground font-mono">${(Number(pool.poolSize) / 1e6).toLocaleString()}</p>
                        </div>
                        <div className="text-center sm:text-left min-w-[60px]">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">APR</p>
                          <p className="text-sm font-bold text-success font-mono">{pool.apy}%</p>
                        </div>
                        <div className="text-center sm:text-left min-w-[80px]">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">Status</p>
                          <StatusBadge status={pool.status} />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                          className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                        <Link to={`/manager/pools?poolId=${pool.id}`} className="flex-1 sm:flex-none">
                          <Button size="sm" className="w-full rounded-xl gradient-primary font-bold px-6 shadow-md glow-primary">
                            Manage
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-border/20 bg-secondary/5 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 py-4">
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Pool APR</p>
                            <p className="text-sm font-bold text-success">{pool.apy}%</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Pool Size</p>
                            <p className="text-sm font-bold">${(Number(pool.poolSize) / 1e6).toLocaleString()}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">LP Token</p>
                            <p className="text-xs font-bold text-foreground/80">{pool.lpTokenName || 'Not Available'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Pool Token</p>
                            <p className="text-xs font-bold text-foreground/80">{pool.poolTokenName || 'USDC'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Pool Contract</p>
                            <AddressLink address={pool.contractAddress} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center text-muted-foreground italic glass-card rounded-2xl border-dashed border-border/50">
                No pools managed at this time.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Audit Log
            </h2>
            <Link to="/manager/history" className="text-sm font-medium text-primary hover:underline">
              Full History Library
            </Link>
          </div>
          <div className="glass-card rounded-2xl p-4 overflow-hidden shadow-xl">
            <TransactionList transactions={txData?.items || []} isLoading={isLoadingTxs} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
