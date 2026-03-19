import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { LiquidFill } from '@/components/LiquidFill';
import { HashScanLink } from '@/components/HashScanLink';
import { mockTxHistory } from '@/data/mockData';
import { Landmark, ArrowDownLeft, Clock, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBorrowerPoolsList } from '@/hooks/useBorrowerPools';
export default function BorrowerDashboard() {
  const { data: borrowerPools = [] } = useBorrowerPoolsList();
  const totalBorrowed = borrowerPools.reduce((s, p) => s + p.totalReceived, 0);
  const totalRepaid = borrowerPools.reduce((s, p) => s + p.totalRepaid, 0);
  const pending = totalBorrowed - totalRepaid;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Borrower Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your pools and track repayments</p>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total Borrowed" value={`$${totalBorrowed.toLocaleString()}`} change="+12.5% this month" changeType="positive" icon={<Landmark className="h-5 w-5" />} />
          <MetricCard title="Total Repaid" value={`$${totalRepaid.toLocaleString()}`} change="On track" changeType="positive" icon={<ArrowDownLeft className="h-5 w-5" />} />
          <MetricCard title="Pending Amount" value={`$${pending.toLocaleString()}`} icon={<Clock className="h-5 w-5" />} />
          <MetricCard title="Active Pools" value={String(borrowerPools.filter(p => p.status === 'active').length)} icon={<Activity className="h-5 w-5" />} />
        </div>

        {/* Pool List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My Pools</h2>
            <Link to="/borrower/pools" className="text-sm text-primary hover:underline">View All →</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {borrowerPools.map(pool => {
              const fillPct = (pool.totalReceived / pool.totalRequested) * 100;
              return (
                <Link
                  key={pool.id}
                  to={`/borrower/pools/${pool.id}`}
                  className="glass-card rounded-2xl p-5 transition-all hover:border-primary/30"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{pool.name}</h3>
                      <p className="text-xs text-muted-foreground">{pool.symbol}</p>
                    </div>
                    <StatusBadge status={pool.status} />
                  </div>
                  <div className="flex items-end justify-between">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Borrowed</p>
                      <p className="text-lg font-bold">${pool.totalReceived.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">of ${pool.totalRequested.toLocaleString()}</p>
                    </div>
                    <LiquidFill percentage={fillPct} size="sm" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Tx Hash</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockTxHistory.filter(tx => tx.type === 'borrow' || tx.type === 'repay').map(tx => (
                  <tr key={tx.id} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-3 capitalize font-medium">{tx.type}</td>
                    <td className="px-4 py-3 font-semibold">${tx.amount.toLocaleString()} <span className="text-xs text-muted-foreground">{tx.token}</span></td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{new Date(tx.timestamp).toLocaleDateString()}</td>
                    <td className="px-4 py-3 hidden md:table-cell"><HashScanLink txHash={tx.txHash} /></td>
                    <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
