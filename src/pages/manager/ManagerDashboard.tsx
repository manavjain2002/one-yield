import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { HashScanLink } from '@/components/HashScanLink';
import { useManagerSummary } from '@/hooks/useManagerSummary';
import { BarChart3, Wallet, Landmark, Clock, ArrowRightLeft } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';
import { TransactionList } from '@/components/TransactionList';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';

import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Settings2 } from 'lucide-react';

export default function ManagerDashboard() {
  const { data: summary } = useManagerSummary();
  const { data: txData, isLoading: isLoadingTxs } = useTransactionHistory(1, 5);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  const pools = summary?.poolsUi ?? [];
  const totalAum = Number(summary?.totalAssetUnderManagement ?? 0) || pools.reduce((s, p) => s + p.totalReceived, 0);
  const poolBalance = totalAum * 0.7;
  const fmBalance = totalAum * 0.3;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Pool Manager Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Oversee pool operations and fund flows</p>
        </div>

        {/* Top Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard title="Available Balance" value={`$${poolBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Clock className="h-5 w-5" />} />
          <MetricCard title="Reserve Balance" value={`$${fmBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Wallet className="h-5 w-5" />} />
          <MetricCard title="Pool Allocation" value={`$${totalAum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Landmark className="h-5 w-5" />} />
        </div>

        {/* Managed Pools List */}
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
                    {/* Main Row */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:flex-nowrap">
                      <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                          {pool.symbol[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">{pool.name}</h3>
                          <p className="text-[10px] text-muted-foreground font-mono">{pool.contractAddress.slice(0, 6)}...{pool.contractAddress.slice(-4)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-8 flex-1 justify-center sm:justify-start">
                        <div className="text-center sm:text-left min-w-[80px]">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">Pool Size</p>
                          <p className="text-sm font-bold text-foreground font-mono">${(Number(pool.poolSize) / 1e6).toLocaleString()}M</p>
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
                          size="sm" 
                          onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                          className="rounded-xl flex-1 sm:flex-none text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                          Details
                        </Button>
                        <Link to={`/manager/pools?poolId=${pool.id}`} className="flex-1 sm:flex-none">
                          <Button size="sm" className="w-full rounded-xl gradient-primary font-bold px-6 shadow-md glow-primary">
                            Manage
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-border/20 bg-primary/[0.02] animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 py-4">
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">Pool APR</p>
                            <p className="text-sm font-bold text-success">{pool.apy}%</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Size</p>
                            <p className="text-sm font-bold text-foreground">${(Number(pool.poolSize) / 1e6).toLocaleString()}M</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">LP Token Name</p>
                            <p className="text-[10px] font-bold text-foreground/80">{pool.lpTokenName || 'Not Available'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Token</p>
                            <p className="text-[10px] font-bold text-foreground/80">{pool.poolTokenName || 'USDC'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Address</p>
                            <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => window.open(`https://hashscan.io/testnet/address/${pool.contractAddress}`, '_blank')}>
                              <p className="text-[10px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
                                {pool.contractAddress.slice(0, 8)}...
                              </p>
                              <ExternalLink className="w-2.0 h-2.0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                            </div>
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

        {/* Recent Activity */}
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
