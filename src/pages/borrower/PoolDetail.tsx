import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { HashScanLink } from '@/components/HashScanLink';
import { mockPools, mockTxHistory } from '@/data/mockData';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['hsl(230, 80%, 60%)', 'hsl(250, 80%, 65%)', 'hsl(200, 80%, 55%)', 'hsl(280, 70%, 60%)'];

export default function PoolDetail() {
  const { poolId } = useParams();
  const pool = mockPools.find(p => p.id === poolId);

  if (!pool) {
    return <DashboardLayout><p className="text-muted-foreground">Pool not found</p></DashboardLayout>;
  }

  const fillPct = (pool.totalReceived / pool.totalRequested) * 100;
  const allocTotal = pool.allocations.reduce((s, a) => s + a.percentage, 0);
  const pieData = pool.allocations.map(a => ({ name: a.wallet, value: a.percentage }));

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <StatusBadge status={pool.status} />
        </div>

        {/* Overview Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Requested', value: `$${pool.totalRequested.toLocaleString()}` },
            { label: 'Total Received', value: `$${pool.totalReceived.toLocaleString()}` },
            { label: 'Total Repaid', value: `$${pool.totalRepaid.toLocaleString()}` },
            { label: 'Fill Progress', value: `${fillPct.toFixed(1)}%` },
          ].map(m => (
            <div key={m.label} className="glass-card rounded-2xl p-5">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-xl font-bold mt-1">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Fill Progress Bar */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Pool Fill Progress</p>
            <span className="text-sm font-bold text-primary">{fillPct.toFixed(1)}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full gradient-primary transition-all duration-1000"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>$0</span>
            <span>${pool.totalRequested.toLocaleString()}</span>
          </div>
          <div className="mt-3">
            <HashScanLink txHash={pool.txHash} label="View on HashScan" />
          </div>
        </div>

        {/* Allocation Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-base font-semibold mb-4">Child Pool Allocation</h3>
            {pieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value">
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '12px' }}
                      labelStyle={{ color: 'hsl(210 40% 96%)' }}
                      itemStyle={{ color: 'hsl(210 40% 96%)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No allocations yet</p>
            )}
            {allocTotal !== 100 && allocTotal > 0 && (
              <p className="text-xs text-warning mt-2">⚠️ Total allocation is {allocTotal}% — must equal 100%</p>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-base font-semibold mb-4">Allocation Table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="py-2 text-left font-medium text-muted-foreground">Wallet</th>
                    <th className="py-2 text-left font-medium text-muted-foreground">%</th>
                    <th className="py-2 text-left font-medium text-muted-foreground">Funds</th>
                  </tr>
                </thead>
                <tbody>
                  {pool.allocations.map((a, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      <td className="py-2.5 font-mono text-xs">{a.wallet}</td>
                      <td className="py-2.5 font-semibold">{a.percentage}%</td>
                      <td className="py-2.5">${a.fundsAssigned.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Repayment */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-semibold mb-4">Repayment</h3>
          <p className="text-xs text-muted-foreground mb-3">Any allocation wallet can repay on behalf of the pool.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-2">
              <Label className="text-xs">Amount to Repay</Label>
              <Input type="number" placeholder="0.00" className="bg-secondary/50 border-border" />
            </div>
            <Button className="gradient-primary rounded-xl self-end">Repay Loan</Button>
          </div>
        </div>

        {/* History Tabs */}
        <Tabs defaultValue="borrow" className="space-y-4">
          <TabsList className="bg-secondary/50 rounded-xl">
            <TabsTrigger value="borrow" className="rounded-lg">Borrow History</TabsTrigger>
            <TabsTrigger value="repay" className="rounded-lg">Repayments</TabsTrigger>
            <TabsTrigger value="received" className="rounded-lg">Funds Received</TabsTrigger>
          </TabsList>
          {['borrow', 'repay', 'received'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Tx Hash</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTxHistory
                      .filter(tx => tab === 'received' ? tx.type === 'deposit' : tx.type === tab)
                      .map(tx => (
                        <tr key={tx.id} className="border-b border-border/30 last:border-0">
                          <td className="px-4 py-3 font-semibold">${tx.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</td>
                          <td className="px-4 py-3 hidden sm:table-cell"><HashScanLink txHash={tx.txHash} /></td>
                          <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
