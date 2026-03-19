import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { HashScanLink } from '@/components/HashScanLink';
import type { Pool } from '@/data/mockData';
import { useManagerSummary } from '@/hooks/useManagerSummary';
import { usePoolTxHistory } from '@/hooks/useTxHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

const COLORS = ['hsl(230, 80%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(250, 80%, 65%)'];

export default function ManagerPools() {
  const { data: summary } = useManagerSummary();
  const pools = summary?.poolsUi ?? [];
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  useEffect(() => {
    if (!pools.length) {
      setSelectedPool(null);
      return;
    }
    setSelectedPool((prev) => {
      if (prev && pools.some((p) => p.id === prev.id)) return prev;
      return pools[0];
    });
  }, [pools]);

  const { data: txHistory = [] } = usePoolTxHistory(selectedPool?.id);

  if (!selectedPool) {
    return (
      <DashboardLayout>
        <div className="p-8 text-muted-foreground">No pools to manage yet.</div>
      </DashboardLayout>
    );
  }

  const poolFunds = selectedPool.totalReceived * 0.7;
  const fmFunds = selectedPool.totalReceived * 0.3;
  const fundsPie = [
    { name: 'In Pool', value: poolFunds },
    { name: 'With Fund Manager', value: fmFunds },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Pool Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage fund flows and pool operations</p>
        </div>

        {/* Pool Selector */}
        <div className="flex gap-2 flex-wrap">
          {pools.map(pool => (
            <button
              key={pool.id}
              onClick={() => setSelectedPool(pool)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                selectedPool.id === pool.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/50'
              }`}
            >
              {pool.name}
            </button>
          ))}
        </div>

        {/* Pool Overview */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Donut Chart */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-base font-semibold mb-4">Fund Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={fundsPie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
                    {fundsPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(222 47% 9%)', border: '1px solid hsl(222 30% 18%)', borderRadius: '12px' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 text-xs">
              {fundsPie.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name}: ${d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Fund Transfer */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold">Fund Transfer</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Transfer Amount (USDC)</Label>
                  <Input type="number" placeholder="0.00" className="bg-secondary/50 border-border" />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-xl border-border text-xs">
                    <ArrowRight className="mr-1 h-3.5 w-3.5" /> Pool → FM
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl border-border text-xs">
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" /> FM → Pool
                  </Button>
                </div>
              </div>
            </div>

            {/* Pool Controls */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold">Pool Controls</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Pool Status</p>
                  <p className="text-xs text-muted-foreground">Toggle to activate or pause this pool</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedPool.status === 'active' ? 'active' : 'paused'} />
                  <Switch checked={selectedPool.status === 'active'} />
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-base font-semibold mb-3">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Pool Funds</span>
                  <span className="font-semibold">${selectedPool.totalReceived.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Repaid</span>
                  <span className="font-semibold">${selectedPool.totalRepaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">APY</span>
                  <span className="font-semibold text-success">{selectedPool.apy}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History Tabs */}
        <Tabs defaultValue="transfers" className="space-y-4">
          <TabsList className="bg-secondary/50 rounded-xl">
            <TabsTrigger value="transfers" className="rounded-lg">Transfers</TabsTrigger>
            <TabsTrigger value="borrower" className="rounded-lg">Borrower Received</TabsTrigger>
            <TabsTrigger value="repayments" className="rounded-lg">Repayments</TabsTrigger>
            <TabsTrigger value="payouts" className="rounded-lg">Lender Payouts</TabsTrigger>
          </TabsList>
          {['transfers', 'borrower', 'repayments', 'payouts'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Tx Hash</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txHistory.map(tx => (
                      <tr key={tx.id} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-3 capitalize font-medium">{tx.type}</td>
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
