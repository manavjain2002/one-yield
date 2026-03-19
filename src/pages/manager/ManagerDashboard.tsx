import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { HashScanLink } from '@/components/HashScanLink';
import { mockPools, mockTxHistory, aumChartData } from '@/data/mockData';
import { BarChart3, Wallet, Landmark, Clock, ArrowRightLeft } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Link } from 'react-router-dom';

export default function ManagerDashboard() {
  const totalAum = mockPools.reduce((s, p) => s + p.totalReceived, 0);
  const poolBalance = totalAum * 0.7;
  const fmBalance = totalAum * 0.3;
  const pendingRepay = mockPools.reduce((s, p) => s + (p.totalReceived - p.totalRepaid), 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Pool Manager Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Oversee pool operations and fund flows</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="AUM" value={`$${totalAum.toLocaleString()}`} change="+18.5% this quarter" changeType="positive" icon={<BarChart3 className="h-5 w-5" />} />
          <MetricCard title="Pool Balance" value={`$${poolBalance.toLocaleString()}`} icon={<Landmark className="h-5 w-5" />} />
          <MetricCard title="Fund Manager Balance" value={`$${fmBalance.toLocaleString()}`} icon={<Wallet className="h-5 w-5" />} />
          <MetricCard title="Pending Repayments" value={`$${pendingRepay.toLocaleString()}`} icon={<Clock className="h-5 w-5" />} />
        </div>

        {/* AUM Chart */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-4">AUM Growth</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={aumChartData}>
                <defs>
                  <linearGradient id="aumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(230 80% 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(230 80% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={12} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '12px' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'AUM']}
                />
                <Area type="monotone" dataKey="aum" stroke="hsl(230 80% 60%)" strokeWidth={2.5} fill="url(#aumGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pools Overview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Managed Pools</h2>
            <Link to="/manager/pools" className="text-sm text-primary hover:underline">Manage →</Link>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {['Pool', 'AUM', 'APY', 'Status', 'Tx Hash'].map(h => (
                    <th key={h} className="px-5 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockPools.map(pool => (
                  <tr key={pool.id} className="border-b border-border/30 last:border-0">
                    <td className="px-5 py-3 font-semibold">{pool.name}</td>
                    <td className="px-5 py-3">${pool.totalReceived.toLocaleString()}</td>
                    <td className="px-5 py-3 text-success font-semibold">{pool.apy}%</td>
                    <td className="px-5 py-3"><StatusBadge status={pool.status} /></td>
                    <td className="px-5 py-3"><HashScanLink txHash={pool.txHash} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Transfers */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockTxHistory.map(tx => (
                  <tr key={tx.id} className="border-b border-border/30 last:border-0">
                    <td className="px-5 py-3 capitalize font-medium flex items-center gap-2">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                      {tx.type}
                    </td>
                    <td className="px-5 py-3 font-semibold">${tx.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</td>
                    <td className="px-5 py-3"><StatusBadge status={tx.status} /></td>
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
