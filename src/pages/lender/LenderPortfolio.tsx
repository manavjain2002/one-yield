import { DashboardLayout } from '@/components/DashboardLayout';
import { mockLenderPositions } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

type WithdrawState = 'idle' | 'warning' | 'amount' | 'queued';

export default function LenderPortfolio() {
  const [withdrawState, setWithdrawState] = useState<WithdrawState>('idle');
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  const handleWithdraw = (poolName: string) => {
    setSelectedPool(poolName);
    setWithdrawState('warning');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">Your active lending positions</p>
        </div>

        {/* Desktop Table */}
        <div className="glass-card rounded-2xl overflow-hidden hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['Pool', 'Deposited', 'Current Value', 'Yield', 'Pending', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-4 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockLenderPositions.map(pos => (
                <tr key={pos.poolId} className="border-b border-border/30 last:border-0">
                  <td className="px-5 py-4 font-semibold">{pos.poolName}</td>
                  <td className="px-5 py-4">${pos.deposited.toLocaleString()}</td>
                  <td className="px-5 py-4 font-semibold">${pos.currentValue.toLocaleString()}</td>
                  <td className="px-5 py-4 text-success font-semibold">+${pos.yield.toLocaleString()}</td>
                  <td className="px-5 py-4">${pos.pending.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <Button size="sm" variant="outline" onClick={() => handleWithdraw(pos.poolName)} className="rounded-lg border-border text-xs">
                      Withdraw
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-3 md:hidden">
          {mockLenderPositions.map(pos => (
            <div key={pos.poolId} className="glass-card rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold">{pos.poolName}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Deposited</span><p className="font-medium">${pos.deposited.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Current Value</span><p className="font-semibold">${pos.currentValue.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Yield</span><p className="font-semibold text-success">+${pos.yield.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Pending</span><p className="font-medium">${pos.pending.toLocaleString()}</p></div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleWithdraw(pos.poolName)} className="w-full rounded-lg border-border">
                Withdraw
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Early Withdrawal Warning */}
      <Dialog open={withdrawState === 'warning'} onOpenChange={() => setWithdrawState('idle')}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="rounded-full bg-warning/15 p-4">
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
            <DialogHeader>
              <DialogTitle>Early Withdrawal</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Withdrawing early from <span className="font-semibold text-foreground">{selectedPool}</span> means you will miss future returns and potential yield.
            </p>
            <div className="flex gap-3 w-full">
              <Button variant="outline" onClick={() => setWithdrawState('idle')} className="flex-1 rounded-xl border-border">
                Cancel
              </Button>
              <Button onClick={() => setWithdrawState('amount')} className="flex-1 rounded-xl bg-warning text-warning-foreground hover:bg-warning/90">
                Continue Withdraw
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Amount Input */}
      <Dialog open={withdrawState === 'amount'} onOpenChange={() => setWithdrawState('idle')}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw from {selectedPool}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Withdraw Amount</Label>
              <Input type="number" placeholder="0.00" className="bg-secondary/50 border-border" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setWithdrawState('queued')} className="flex-1 rounded-xl border-border">
                <Clock className="mr-2 h-4 w-4" /> Queue Withdraw
              </Button>
              <Button className="flex-1 gradient-primary rounded-xl">
                Instant Withdraw
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Queue State */}
      <Dialog open={withdrawState === 'queued'} onOpenChange={() => setWithdrawState('idle')}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-4 py-6">
            <div className="rounded-full bg-primary/15 p-4">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <DialogHeader>
              <DialogTitle>Withdrawal Queued</DialogTitle>
            </DialogHeader>
            <div className="rounded-xl bg-secondary/50 p-4 w-full space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Queue Position</span>
                <span className="font-bold">#3</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Wait</span>
                <span className="font-bold">~2 hours</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => setWithdrawState('idle')} className="rounded-xl border-border w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
