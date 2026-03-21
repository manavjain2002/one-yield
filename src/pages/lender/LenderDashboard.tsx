import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge, RiskBadge } from '@/components/StatusBadge';
import { useLenderPositions } from '@/hooks/useLenderPositions';
import { useLenderPerformance } from '@/hooks/useLenderPerformance';
import { usePoolsList } from '@/hooks/usePools';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, TrendingUp, Clock, LineChart as ChartIcon, Landmark, DollarSign, LayoutDashboard, Search, Filter, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { TransactionList } from '@/components/TransactionList';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function LenderDashboard() {
  const { data: positions = [] } = useLenderPositions();
  const { data: pools = [] } = usePoolsList();
  const { data: performance = [], isLoading: isLoadingPerf } = useLenderPerformance();
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  const platformTvl = pools.reduce((s, p) => s + p.totalReceived, 0);
  const platformInterest = pools.reduce((s, p) => s + (p.totalReceived * p.apy / 100 / 2), 0);

  const { data: txData, isLoading: isLoadingTxs } = useTransactionHistory(1, 5);

  const activePools = pools.filter(p => p.status === 'active' || p.status === 'paused').slice(0, 3);

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
          {/* Platform Stats */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ChartIcon className="w-5 h-5 text-primary" />
                Market Statistics
              </h2>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-secondary/30 px-3 py-1 rounded-full border border-border/50">Updated Real-Time</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard title="Total Value Locked" value={`$${Math.round(platformTvl).toLocaleString()}`} icon={<Landmark className="h-5 w-5" />} />
              <MetricCard title="Total Interest Paid" value={`$${Math.round(platformInterest).toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
              <MetricCard title="Avg Pool APR" value="8.4%" icon={<TrendingUp className="h-5 w-5 text-success" />} />
              <MetricCard title="Active Lenders" value="1,248" icon={<TrendingUp className="h-5 w-5 text-success" />} />
              <MetricCard title="Total Pools" value={String(pools.length)} icon={<TrendingUp className="h-5 w-5 text-success" />} />
            </div>
          </div>

          {/* Earn Opportunities */}
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
                  const actualFillPct = (pool.totalReceived / nominalPoolSize) * 100;

                  return (
                    <div key={pool.id} className="glass-card rounded-2xl overflow-hidden border border-border/40 transition-all hover:border-primary/20 group">
                      <div className="flex flex-wrap items-center justify-between gap-4 p-6 sm:flex-nowrap">
                        <div className="flex items-center gap-4 min-w-[200px]">
                          <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold shadow-inner group-hover:scale-110 transition-transform">
                            {pool.symbol[0]}
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">{pool.name}</h3>
                            <p className="text-[10px] text-muted-foreground font-mono opacity-60">{pool.contractAddress.slice(0, 10)}...{pool.contractAddress.slice(-6)}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-10 flex-1 justify-center sm:justify-start font-mono text-sm font-bold">
                          <div className="text-center sm:text-left min-w-[90px]">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5 opacity-70">Pool Size</p>
                            <p className="text-lg tracking-tighter">${nominalPoolSize.toLocaleString()}M</p>
                          </div>
                          <div className="text-center sm:text-left min-w-[70px]">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5 opacity-70">Variable APY</p>
                            <p className="text-lg text-success tracking-tighter">{pool.apy}%</p>
                          </div>
                          <div className="text-center sm:text-left min-w-[90px]">
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5 opacity-70">Risk Rating</p>
                            <RiskBadge level={pool.riskLevel} />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                            className="rounded-xl flex-1 sm:flex-none text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                          >
                            {isExpanded ? 'Hide Details' : 'View Details'}
                          </Button>
                          <Link to={`/lender/pools?poolId=${pool.id}`} className="flex-1 sm:flex-none">
                            <Button size="sm" className="w-full rounded-xl gradient-primary font-bold px-10 h-10 shadow-lg glow-primary hover:scale-105 active:scale-95 transition-all">
                              Transact
                            </Button>
                          </Link>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 border-t border-border/20 bg-primary/[0.02] animate-in slide-in-from-top-2 duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-4">
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">LP Token Identifier</p>
                              <p className="text-xs font-bold text-foreground/90">{pool.lpTokenName || `OneYield ${pool.symbol} LP`}</p>
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">On-Chain Contract</p>
                              <p className="text-[10px] font-mono text-muted-foreground truncate opacity-70">{pool.contractAddress}</p>
                            </div>
                            <div className="col-span-1 md:col-span-2 space-y-3">
                               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                 <span className="text-muted-foreground">Liquidity Progress</span>
                                 <span className="text-primary">{actualFillPct.toFixed(1)}% Subscribed</span>
                               </div>
                               <div className="h-2 overflow-hidden rounded-full bg-secondary/40 border border-border/20 p-[1px]">
                                 <div className="h-full rounded-full gradient-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" style={{ width: `${actualFillPct}%` }} />
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
                  <div className="h-10 w-10 rounded-full bg-secondary/50 flex items-center justify-center mb-2">
                    <Clock className="h-5 w-5 opacity-30" />
                  </div>
                  No active pools found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
