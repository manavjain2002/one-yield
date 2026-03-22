import { DashboardLayout } from '@/components/DashboardLayout';
import { useLenderPositions } from '@/hooks/useLenderPositions';
import { MetricCard } from '@/components/MetricCard';
import { TrendingUp, DollarSign, Percent, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useLenderActions } from '@/hooks/useLenderActions';
import type { LenderPosition, Pool } from '@/data/mockData';
import { formatUnits, parseUnits } from 'ethers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { getLendingPoolRead } from '@/lib/contracts';
import { TransactModal } from '@/components/TransactModal';

type TransactState = 'idle' | 'transact' | 'queued';

export default function LenderPortfolio() {
  const { data: positions = [] } = useLenderPositions();
  const [transactState, setTransactState] = useState<TransactState>('idle');
  const [selectedPos, setSelectedPos] = useState<LenderPosition | null>(null);
  const [amount, setAmount] = useState('');

  const totalDeposited = positions.reduce((s, p) => s + p.deposited, 0);
  const totalWithdrawn = positions.reduce((s, p) => s + p.withdrawn, 0);
  const currentValue = positions.reduce((s, p) => s + p.currentValue, 0);
  const yieldEarned = positions.reduce((s, p) => s + p.yield, 0);
  const pending = positions.reduce((s, p) => s + p.pending, 0);

  // Log state transitions for transparency
  const setWithLog = (s: TransactState) => {
    console.log(`%c[Portfolio] Transitioning UI state: ${transactState} -> ${s}`, 'color: #3b82f6; font-style: italic;');
    setTransactState(s);
  };

  // Synthesize a minimal Pool object for the hook
  const poolContext = selectedPos?.contractAddress ? {
    id: selectedPos.poolId,
    contractAddress: selectedPos.contractAddress,
    poolTokenAddress: selectedPos.poolTokenAddress,
    poolTokenName: 'USDC', // Since mock
    symbol: 'LP',
    name: selectedPos.poolName,
  } as Pool : null;

  const { withdraw, deposit, approve, allowance, isPaused, maxWithdraw, isLoadingLimits } = useLenderActions(poolContext);

  const handleTransactClick = (pos: LenderPosition) => {
    console.log('[Portfolio] Initializing transact modal for:', pos.poolName);
    setSelectedPos(pos);
    setAmount('');
    setWithLog('transact');
  };

  const exchangeRateQuery = useQuery({
    queryKey: ['exchange-rate', selectedPos?.contractAddress, amount],
    queryFn: async () => {
      if (!selectedPos?.contractAddress || !amount || isNaN(Number(amount))) return { shares: 0n, assets: 0n };
      const contract = getLendingPoolRead(selectedPos.contractAddress);
      try {
        const amtBN = parseUnits(amount, 6);
        const [shares, assets] = await Promise.all([
          contract.convertToShares(amtBN).catch(() => amtBN),
          contract.convertToAssets(amtBN).catch(() => amtBN),
        ]);
        return { shares, assets };
      } catch {
        return { shares: 0n, assets: 0n };
      }
    },
    enabled: !!selectedPos?.contractAddress && !!amount,
    refetchInterval: 5000,
  });

  const maxWithdrawStr = formatUnits(maxWithdraw, 6);
  const amountBN = amount && !isNaN(Number(amount)) ? parseUnits(amount, 6) : 0n;
  const needsApproval = amountBN > allowance;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black tracking-tighter">My Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Performance summary and active positions</p>
        </div>

        {/* Metrics Section */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard title="Total Deposited" value={`$${totalDeposited.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
          <MetricCard title="Total Withdrawn" value={`$${totalWithdrawn.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} />
          <MetricCard title="Current Value" value={`$${currentValue.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} />
          <MetricCard title="Yield Earned" value={`$${yieldEarned.toLocaleString()}`} icon={<Percent className="h-5 w-5" />} />
          <MetricCard title="Pending Returns" value={`$${pending.toLocaleString()}`} icon={<Clock className="h-5 w-5" />} />
        </div>

        {/* Desktop Table - Enhanced Styling */}
        <div className="glass-card rounded-2xl overflow-hidden hidden md:block border border-border/30 shadow-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/10 border-b border-border/50 uppercase tracking-widest text-[10px] font-black">
                {['Pool', 'Deposited', 'Current Value', 'Yield', 'Pending', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-5 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {positions.length > 0 ? positions.map(pos => (
                <tr key={pos.poolId} className="hover:bg-secondary/5 transition-colors group">
                  <td className="px-6 py-5 font-bold text-base group-hover:text-primary transition-colors">{pos.poolName}</td>
                  <td className="px-6 py-5 font-medium">${pos.deposited.toLocaleString()}</td>
                  <td className="px-6 py-5 font-black text-foreground">${pos.currentValue.toLocaleString()}</td>
                  <td className="px-6 py-5 text-success font-black text-base">+${pos.yield.toLocaleString()}</td>
                  <td className="px-6 py-5 font-medium text-muted-foreground/60 tracking-tighter">${pos.pending.toLocaleString()}</td>
                  <td className="px-6 py-5">
                    <Button size="sm" variant="outline" onClick={() => handleTransactClick(pos)} className="rounded-xl border-border/50 text-xs font-bold hover:bg-primary/20 hover:text-primary hover:border-primary/50 transition-all">
                      Transact
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground italic bg-secondary/5">
                    You have no active lending positions. Browse pools to start earning.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards (Keep as is or refine) */}
        <div className="space-y-3 md:hidden">
          {positions.map(pos => (
            <div key={pos.poolId} className="glass-card rounded-2xl p-5 space-y-3">
              <h3 className="font-semibold">{pos.poolName}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Deposited</span><p className="font-medium">${pos.deposited.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Current Value</span><p className="font-semibold">${pos.currentValue.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Yield</span><p className="font-semibold text-success">+${pos.yield.toLocaleString()}</p></div>
                <div><span className="text-muted-foreground">Pending</span><p className="font-medium">${pos.pending.toLocaleString()}</p></div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleTransactClick(pos)} className="w-full rounded-lg border-border">
                Transact
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Unified Transact Modal */}
      {selectedPos && poolContext && (
        <TransactModal 
          isOpen={transactState === 'transact'} 
          onClose={() => setWithLog('idle')} 
          pool={poolContext} 
        />
      )}

      {/* Queue State */}
      <Dialog open={transactState === 'queued'} onOpenChange={() => setWithLog('idle')}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md rounded-3xl p-8">
          <div className="flex flex-col items-center text-center space-y-6 py-6">
            <div className="rounded-full bg-primary/20 p-6 animate-bounce">
              <Clock className="h-10 w-10 text-primary" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Withdrawal Queued</DialogTitle>
            </DialogHeader>
            <div className="rounded-3xl bg-secondary/10 border border-border/30 p-6 w-full space-y-4 shadow-inner">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Queue Position</span>
                <span className="font-black text-primary text-lg">#3</span>
              </div>
              <div className="h-[1px] bg-border/50 w-full" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Estimated Wait</span>
                <span className="font-black text-foreground">~2 hours</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => setWithLog('idle')} className="rounded-2xl border-border/50 w-full py-6 font-bold hover:bg-secondary/10 transition-all">
              Return to Portfolio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
