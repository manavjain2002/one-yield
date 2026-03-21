import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { HashScanLink } from '@/components/HashScanLink';
import { useParams, Link } from 'react-router-dom';
import { usePool } from '@/hooks/usePool';
import { usePoolTxHistory } from '@/hooks/useTxHistory';
import { useRepay } from '@/hooks/useRepay';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const COLORS = ['hsl(230, 80%, 60%)', 'hsl(250, 80%, 65%)', 'hsl(200, 80%, 55%)', 'hsl(280, 70%, 60%)'];

export default function PoolDetail() {
  const { poolId } = useParams();
  const { data: pool, isLoading } = usePool(poolId);
  const { data: txHistory = [] } = usePoolTxHistory(pool?.id ?? poolId);
  const { repayLoan } = useRepay();
  const [repayAmount, setRepayAmount] = useState('');

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          Loading pool…
        </div>
      </DashboardLayout>
    );
  }

  if (!pool) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-lg text-muted-foreground mb-4">Pool not found</p>
          <Link to="/borrower/pools">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Pools
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const fillPct = (pool.totalReceived / pool.totalRequested) * 100;
  const allocTotal = pool.allocations.reduce((s, a) => s + a.percentage, 0);
  const pieData = pool.allocations.map(a => ({ name: a.wallet, value: a.percentage }));
  const outstanding = pool.totalReceived - pool.totalRepaid;

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/borrower/pools" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold sm:text-2xl">{pool.name}</h1>
                <StatusBadge status={pool.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{pool.symbol} · {pool.acceptedTokens.join(', ')}</p>
            </div>
          </div>
          <HashScanLink txHash={pool.txHash} label="View on HashScan" />
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            { label: 'Target Pool Size', value: `$${Number(pool.poolSize) > 0 ? (Number(pool.poolSize) / 1e6).toLocaleString() : pool.totalRequested.toLocaleString()}` },
            { label: 'Total Received', value: `$${Number(pool.totalDeposited) > 0 ? (Number(pool.totalDeposited) / 1e6).toLocaleString() : pool.totalReceived.toLocaleString()}` },
            { label: 'Total Repaid', value: `$${pool.totalRepaid.toLocaleString()}` },
            { label: 'Outstanding', value: `$${outstanding.toLocaleString()}` },
          ].map(m => (
            <div key={m.label} className="glass-card rounded-2xl p-4 sm:p-5">
              <p className="text-[11px] sm:text-xs text-muted-foreground">{m.label}</p>
              <p className="text-lg font-bold mt-1 sm:text-xl">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Fill Progress Bar */}
        <div className="glass-card rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">Pool Fill Progress</p>
            <span className="text-sm font-bold text-primary">{fillPct.toFixed(1)}%</span>
          </div>
          <div className="h-3 sm:h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full gradient-primary transition-all duration-1000"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>$0</span>
            <span>${pool.totalRequested.toLocaleString()}</span>
          </div>
        </div>

        {/* Allocation Section */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Pie Chart */}
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold sm:text-base mb-4">Child Pool Allocation</h3>
            {pieData.length > 0 ? (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={4} dataKey="value">
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '10px' }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                      formatter={(value: number) => [`${value}%`, 'Alloc']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-52 items-center justify-center">
                <p className="text-sm text-muted-foreground">No allocations yet</p>
              </div>
            )}
            {allocTotal !== 100 && allocTotal > 0 && (
              <p className="text-xs text-warning mt-2">⚠️ Total allocation is {allocTotal}% — must equal 100%</p>
            )}
          </div>

          {/* Allocation Table */}
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold sm:text-base mb-4">Allocation Table</h3>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="px-4 sm:px-0 py-2 text-left font-medium text-muted-foreground text-xs">Wallet</th>
                    <th className="py-2 text-left font-medium text-muted-foreground text-xs">%</th>
                    <th className="py-2 text-right font-medium text-muted-foreground text-xs pr-4 sm:pr-0">Funds</th>
                  </tr>
                </thead>
                <tbody>
                  {pool.allocations.map((a, i) => (
                    <tr key={i} className="border-b border-border/30 last:border-0">
                      <td className="px-4 sm:px-0 py-3 font-mono text-xs truncate max-w-[120px] sm:max-w-none">{a.wallet}</td>
                      <td className="py-3 font-semibold text-sm">{a.percentage}%</td>
                      <td className="py-3 text-right pr-4 sm:pr-0">${a.fundsAssigned.toLocaleString()}</td>
                    </tr>
                  ))}
                  {pool.allocations.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-muted-foreground text-sm">No allocations configured</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Repayment */}
        <div className="glass-card rounded-2xl p-4 sm:p-6">
          <h3 className="text-sm font-semibold sm:text-base mb-2">Repayment</h3>
          <p className="text-xs text-muted-foreground mb-4">Any allocation wallet can repay on behalf of the pool.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label className="text-xs">Amount to Repay</Label>
              <Input 
                type="number" 
                placeholder="0.00" 
                className="bg-secondary/50 border-border" 
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
              />
            </div>
            <Button 
              className="gradient-primary rounded-xl w-full sm:w-auto"
              disabled={repayLoan.isPending || !repayAmount}
              onClick={() => {
                if (pool) {
                  repayLoan.mutate(
                    { pool, amount: repayAmount },
                    { onSuccess: () => setRepayAmount('') }
                  );
                }
              }}
            >
              {repayLoan.isPending ? 'Repaying...' : 'Repay Loan'}
            </Button>
          </div>
        </div>

        {/* History Tabs */}
        <Tabs defaultValue="borrow" className="space-y-4">
          <TabsList className="bg-secondary/50 rounded-xl w-full sm:w-auto flex">
            <TabsTrigger value="borrow" className="rounded-lg flex-1 sm:flex-initial text-xs sm:text-sm">Borrow History</TabsTrigger>
            <TabsTrigger value="repay" className="rounded-lg flex-1 sm:flex-initial text-xs sm:text-sm">Repayments</TabsTrigger>
            <TabsTrigger value="received" className="rounded-lg flex-1 sm:flex-initial text-xs sm:text-sm">Funds Received</TabsTrigger>
          </TabsList>
          {['borrow', 'repay', 'received'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Amount</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Tx Hash</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txHistory
                        .filter(tx => tab === 'received' ? tx.type === 'deposit' : tx.type === tab)
                        .map(tx => (
                          <tr key={tx.id} className="border-b border-border/30 last:border-0">
                            <td className="px-4 py-3 font-semibold">${tx.amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(tx.timestamp).toLocaleDateString()}</td>
                            <td className="px-4 py-3"><HashScanLink txHash={tx.txHash} /></td>
                            <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                          </tr>
                        ))}
                      {txHistory.filter(tx => tab === 'received' ? tx.type === 'deposit' : tx.type === tab).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No transactions yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}