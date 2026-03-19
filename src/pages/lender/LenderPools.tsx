import { DashboardLayout } from '@/components/DashboardLayout';
import { RiskBadge } from '@/components/StatusBadge';
import { usePoolsList } from '@/hooks/usePools';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { Pool } from '@/data/mockData';

export default function LenderPools() {
  const [depositPool, setDepositPool] = useState<Pool | null>(null);
  const [amount, setAmount] = useState('');
  const { data: pools = [] } = usePoolsList();
  const activePools = pools.filter(p => p.status === 'active');

  const expectedYield = amount ? (parseFloat(amount) * (depositPool?.apy || 0) / 100).toFixed(2) : '0.00';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Earn</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse and deposit into available pools</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activePools.map(pool => {
            const fillPct = (pool.totalReceived / pool.totalRequested) * 100;
            return (
              <div key={pool.id} className="glass-card rounded-2xl p-6 transition-all hover:border-primary/30">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{pool.name}</h3>
                    <p className="text-xs text-muted-foreground">{pool.symbol} · {pool.acceptedTokens.join(', ')}</p>
                  </div>
                  <RiskBadge level={pool.riskLevel} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">APY</span>
                    <span className="text-xl font-bold text-success">{pool.apy}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Balance</span>
                    <span className="font-medium">${pool.totalReceived.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fund Mgr Balance</span>
                    <span className="font-medium">${(pool.totalReceived * 0.3).toLocaleString()}</span>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Fill Progress</span>
                      <span>{fillPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full gradient-primary transition-all duration-700" style={{ width: `${fillPct}%` }} />
                    </div>
                  </div>
                  <Button onClick={() => { setDepositPool(pool); setAmount(''); }} className="w-full gradient-primary rounded-xl">
                    Deposit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deposit Modal */}
      <Dialog open={!!depositPool} onOpenChange={() => setDepositPool(null)}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deposit into {depositPool?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Deposit Amount (USDC)</Label>
              <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="bg-secondary/50 border-border text-lg" />
            </div>

            <div className="rounded-xl bg-secondary/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected Yield (Annual)</span>
                <span className="font-semibold text-success">${expectedYield}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">LP Tokens Received</span>
                <span className="font-semibold">{amount || '0'} LP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">APY</span>
                <span className="font-semibold text-success">{depositPool?.apy}%</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl border-border">Approve</Button>
              <Button className="flex-1 gradient-primary rounded-xl">Deposit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
