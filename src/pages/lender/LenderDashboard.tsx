import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { RiskBadge } from '@/components/StatusBadge';
import { apyChartData } from '@/data/mockData';
import { useLenderPositions } from '@/hooks/useLenderPositions';
import { usePoolsList } from '@/hooks/usePools';
import { TrendingUp, DollarSign, Percent, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

export default function LenderDashboard() {
  const { data: positions = [] } = useLenderPositions();
  const { data: pools = [] } = usePoolsList();
  const totalDeposited = positions.reduce((s, p) => s + p.deposited, 0);
  const currentValue = positions.reduce((s, p) => s + p.currentValue, 0);
  const yieldEarned = positions.reduce((s, p) => s + p.yield, 0);
  const pending = positions.reduce((s, p) => s + p.pending, 0);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Lender Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your deposits and yields</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total Deposited" value={`$${totalDeposited.toLocaleString()}`} change="+$50K this month" changeType="positive" icon={<DollarSign className="h-5 w-5" />} />
          <MetricCard title="Current Value" value={`$${currentValue.toLocaleString()}`} change="+8.2%" changeType="positive" icon={<TrendingUp className="h-5 w-5" />} />
          <MetricCard title="Yield Earned" value={`$${yieldEarned.toLocaleString()}`} icon={<Percent className="h-5 w-5" />} />
          <MetricCard title="Pending Returns" value={`$${pending.toLocaleString()}`} icon={<Clock className="h-5 w-5" />} />
        </div>

        {/* APY Chart */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-4">APY Performance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={apyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 30% 18%)" />
                <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={12} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={12} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '12px' }}
                  labelStyle={{ color: 'hsl(210 40% 96%)' }}
                  formatter={(value: number) => [`${value}%`, 'APY']}
                />
                <Line type="monotone" dataKey="apy" stroke="hsl(230 80% 60%)" strokeWidth={2.5} dot={{ fill: 'hsl(230 80% 60%)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Available Pools */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Available Pools</h2>
            <Link to="/lender/pools" className="text-sm text-primary hover:underline">View All →</Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pools.filter(p => p.status === 'active').map(pool => {
              const fillPct = (pool.totalReceived / pool.totalRequested) * 100;
              return (
                <div key={pool.id} className="glass-card rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{pool.name}</h3>
                      <p className="text-xs text-muted-foreground">{pool.symbol}</p>
                    </div>
                    <RiskBadge level={pool.riskLevel} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">APY</span>
                      <span className="font-bold text-success">{pool.apy}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pool Balance</span>
                      <span className="font-medium">${pool.totalReceived.toLocaleString()}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Filled</span>
                        <span>{fillPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full gradient-primary" style={{ width: `${fillPct}%` }} />
                      </div>
                    </div>
                    <Link to="/lender/pools" className="block">
                      <button className="w-full rounded-xl gradient-primary py-2 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90">
                        Deposit
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
