import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Landmark, ArrowDownLeft, Clock, Activity, ChevronDown, ChevronUp, ExternalLink, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBorrowerPoolsList } from '@/hooks/useBorrowerPools';
import { TransactionList } from '@/components/TransactionList';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { DedicatedWalletsConfig } from './DedicatedWalletsConfig';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { RepayModal } from '@/components/RepayModal';

export default function BorrowerDashboard() {
  const { data: borrowerPools = [] } = useBorrowerPoolsList();
  const { data: txData, isLoading: isLoadingTxs } = useTransactionHistory(1, 5);

  const [selectedRepayPool, setSelectedRepayPool] = useState<any>(null);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  const totalPrincipal = borrowerPools.reduce((s, p) => s + Math.max(0, p.totalReceived - p.totalRepaid), 0);
  const totalCoupon = borrowerPools.reduce((s, p) => s + (Math.max(0, p.totalReceived - p.totalRepaid) * p.apy / 2), 0);
  const totalOutstanding = totalPrincipal + totalCoupon;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Borrower Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Manage your active pools and track repayments</p>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Outstanding Principal" value={`$${totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Landmark className="h-5 w-5" />} />
          <MetricCard title="Outstanding Coupon" value={`$${totalCoupon.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Activity className="h-5 w-5" />} />
          <MetricCard title="Total Debt" value={`$${totalOutstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Clock className="h-5 w-5" />} />
          <MetricCard title="Active Pools" value={String(borrowerPools.filter(p => p.status === 'active').length)} icon={<Activity className="h-5 w-5" />} />
        </div>

        {/* My Pools Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              My Active Pools
            </h2>
            <Link to="/borrower/pools" className="text-sm font-medium text-primary hover:opacity-80 transition-all underline-offset-4 hover:underline">
              View All Pools
            </Link>
          </div>
          
          <div className="space-y-3">
            {borrowerPools.length > 0 ? (
              borrowerPools.map(pool => {
                const isExpanded = expandedPoolId === pool.id;
                const principal = Math.max(0, pool.totalReceived - pool.totalRepaid);
                const coupon = principal * pool.apy / 2;
                const outstanding = principal + coupon;
                const nominalPoolSize = Number(pool.poolSize) / 1e6;

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

                      <div className="flex flex-wrap items-center gap-8 flex-1 justify-center sm:justify-start font-mono text-sm font-bold">
                        <div className="text-center sm:text-left min-w-[100px]">
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Outstanding</p>
                          <p className="text-foreground">${outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="text-center sm:text-left min-w-[80px]">
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Coupon</p>
                          <p className="text-primary/70">${coupon.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="text-center sm:text-left min-w-[60px]">
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">APR</p>
                          <p className="text-success">{pool.apy}%</p>
                        </div>
                        <div className="text-center sm:text-left min-w-[80px]">
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Status</p>
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
                        <Button 
                          size="sm" 
                          onClick={() => setSelectedRepayPool(pool)}
                          className="flex-1 sm:flex-none rounded-xl gradient-primary font-bold px-8 shadow-md glow-primary transition-all active:scale-95"
                          disabled={outstanding <= 0}
                        >
                          Repay
                        </Button>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-border/20 bg-primary/[0.02] animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-4">
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">Dedicated Wallet</p>
                            <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => window.open(`https://hashscan.io/testnet/address/${pool.borrowerPools[0]?.dedicatedWalletAddress}`, '_blank')}>
                              <p className="text-[10px] font-mono text-muted-foreground group-hover:text-primary">
                                {pool.borrowerPools[0]?.dedicatedWalletAddress ? `${pool.borrowerPools[0].dedicatedWalletAddress.slice(0, 10)}...` : 'N/A'}
                              </p>
                              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50 group-hover:text-primary" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Size</p>
                            <p className="text-xs font-bold text-foreground/80">${nominalPoolSize.toLocaleString()}M</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">Principal Repaid</p>
                            <p className="text-xs font-bold text-success">${pool.totalRepaid.toLocaleString()}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Address</p>
                            <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => window.open(`https://hashscan.io/testnet/address/${pool.contractAddress}`, '_blank')}>
                              <p className="text-[10px] font-mono text-muted-foreground group-hover:text-primary">{pool.contractAddress.slice(0, 8)}...</p>
                              <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50 group-hover:text-primary" />
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
                No active pools found. <Link to="/borrower/pools" className="text-primary hover:underline">Create your first pool →</Link>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Recent Activity */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <Link to="/borrower/history" className="text-sm text-primary hover:underline font-medium">View All</Link>
            </div>
            <div className="glass-card rounded-2xl overflow-hidden p-1">
              <TransactionList transactions={txData?.items || []} isLoading={isLoadingTxs} />
            </div>
          </div>

          {/* Config */}
          <div className="space-y-4 lg:col-span-1">
            <DedicatedWalletsConfig />
          </div>
        </div>

        {selectedRepayPool && (
          <RepayModal
            isOpen={!!selectedRepayPool}
            onClose={() => setSelectedRepayPool(null)}
            poolId={selectedRepayPool.id}
            v1PoolId={selectedRepayPool.borrowerPools[0]?.v1PoolId || ''}
            poolName={selectedRepayPool.name}
            symbol={selectedRepayPool.symbol}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
