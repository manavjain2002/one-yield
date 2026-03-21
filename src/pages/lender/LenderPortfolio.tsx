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

type TransactState = 'idle' | 'transact' | 'queued';

export default function LenderPortfolio() {
  const { data: positions = [] } = useLenderPositions();
  const [transactState, setTransactState] = useState<TransactState>('idle');
  const [selectedPos, setSelectedPos] = useState<LenderPosition | null>(null);
  const [amount, setAmount] = useState('');

  const totalDeposited = positions.reduce((s, p) => s + p.deposited, 0);
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Total Deposited" value={`$${totalDeposited.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
          <MetricCard title="Current Value" value={`$${currentValue.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} />
          <MetricCard title="Yield Earned" value={`$${yieldEarned.toLocaleString()}`} icon={<Percent className="h-5 w-5" />} />
          <MetricCard title="Pending Returns" value={`$${pending.toLocaleString()}`} icon={<Clock className="h-5 w-5" />} />
        </div>

        {/* Desktop Table - Enhanced Styling */}
        <div className="glass-card rounded-2xl overflow-hidden hidden md:block border border-white/5 shadow-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 uppercase tracking-widest text-[10px] font-black">
                {['Pool', 'Deposited', 'Current Value', 'Yield', 'Pending', 'Actions'].map(h => (
                  <th key={h} className="px-6 py-5 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {positions.length > 0 ? positions.map(pos => (
                <tr key={pos.poolId} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5 font-bold text-base group-hover:text-primary transition-colors">{pos.poolName}</td>
                  <td className="px-6 py-5 font-medium">${pos.deposited.toLocaleString()}</td>
                  <td className="px-6 py-5 font-black text-white">${pos.currentValue.toLocaleString()}</td>
                  <td className="px-6 py-5 text-success font-black text-base">+${pos.yield.toLocaleString()}</td>
                  <td className="px-6 py-5 font-medium text-muted-foreground/60 tracking-tighter">${pos.pending.toLocaleString()}</td>
                  <td className="px-6 py-5">
                    <Button size="sm" variant="outline" onClick={() => handleTransactClick(pos)} className="rounded-xl border-white/10 text-xs font-bold hover:bg-primary/20 hover:text-primary hover:border-primary/50 transition-all">
                      Transact
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-muted-foreground italic bg-white/[0.01]">
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
      <Dialog open={transactState === 'transact'} onOpenChange={() => setWithLog('idle')}>
        <DialogContent className="glass-card border-white/10 sm:max-w-md rounded-[2.5rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tight mb-1">
              Transact <span className="text-primary">{selectedPos?.poolName}</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase">
              Current Position: ${selectedPos?.currentValue.toLocaleString()}
            </p>
          </DialogHeader>

          <Tabs defaultValue="deposit" className="w-full mt-6">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-white/5 p-1 mb-6 h-12">
              <TabsTrigger value="deposit" className="rounded-xl font-bold uppercase tracking-wider text-xs">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw" className="rounded-xl font-bold uppercase tracking-wider text-xs">Withdraw</TabsTrigger>
            </TabsList>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="uppercase text-[10px] font-black tracking-widest text-muted-foreground ml-1">Amount (USDC)</Label>
                <div className="relative group">
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)}
                    className="bg-white/5 border-white/10 h-16 rounded-2xl text-xl font-bold focus:ring-primary/20 transition-all px-6 pr-16" 
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground/40 group-focus-within:text-primary transition-colors">USDC</div>
                </div>
              </div>
              
              <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex flex-col gap-2 shadow-inner">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">Exchange Rate Polling <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /></span>
                </div>
                {amount && !isNaN(Number(amount)) && (
                  <div className="text-[10px] text-muted-foreground tracking-wide font-mono mt-1">
                    <p>1 {selectedPos?.poolTokenAddress ? 'USDC' : 'Asset'} ≈ {exchangeRateQuery.data ? formatUnits(exchangeRateQuery.data.shares || 0n, 6) : '...'} LP Shares</p>
                    <p>1 LP Share ≈ {exchangeRateQuery.data ? formatUnits(exchangeRateQuery.data.assets || 0n, 6) : '...'} {selectedPos?.poolTokenAddress ? 'USDC' : 'Assets'}</p>
                  </div>
                )}
              </div>

              <TabsContent value="deposit">
                <div className="flex flex-col gap-4">
                  <Button
                    className={`h-14 w-full rounded-2xl font-black transition-all shadow-lg ${
                      isPaused || !amount
                        ? 'bg-white/5 text-muted-foreground cursor-not-allowed opacity-40'
                        : 'gradient-primary text-primary-foreground shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98]'
                    }`}
                    disabled={approve.isPending || deposit.isPending || !amount || isPaused}
                    onClick={async () => {
                      try {
                        if (needsApproval) {
                          await approve.mutateAsync(amount);
                        }
                        await deposit.mutateAsync(amount);
                        setWithLog('idle');
                        setAmount('');
                      } catch (e) {
                        // Handled by toast
                      }
                    }}
                  >
                    {isPaused
                      ? 'PAUSED'
                      : approve.isPending
                      ? 'APPROVING USDC...'
                      : deposit.isPending
                      ? 'DEPOSITING...'
                      : needsApproval && amount
                      ? `APPROVE & DEPOSIT`
                      : 'CONFIRM DEPOSIT'}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="withdraw">
                <div className="flex justify-between items-center mb-4 px-2">
                  <p className="text-[10px] text-muted-foreground italic font-medium">
                    {isPaused ? 'Pool is currently paused.' : `Available Liquidity: $${Number(maxWithdrawStr).toLocaleString()}`}
                  </p>
                  {!isPaused && (
                    <button 
                      onClick={() => setAmount(maxWithdrawStr)}
                      className="text-[10px] text-primary hover:opacity-80 font-black uppercase tracking-widest hover:underline transition-all underline-offset-4"
                    >
                      Use Max
                    </button>
                  )}
                </div>
                <div className="flex gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setWithLog('queued')} 
                    className="flex-1 rounded-2xl border-white/10 py-7 font-bold hover:bg-white/5 transition-all text-muted-foreground hover:text-white"
                  >
                    <Clock className="mr-2 h-5 w-5" /> Queue
                  </Button>
                  <Button 
                    onClick={() => withdraw.mutate(amount, { onSuccess: () => setWithLog('idle') })}
                    disabled={withdraw.isPending || !amount || isPaused || isLoadingLimits}
                    className={`flex-[1.5] rounded-2xl font-black py-7 text-base shadow-2xl transition-all active:scale-95 ${
                      isPaused ? 'bg-secondary text-muted-foreground' : 'gradient-primary text-primary-foreground hover:shadow-primary/40'
                    }`}
                  >
                    {isPaused ? 'PAUSED' : withdraw.isPending ? 'SIGNING...' : 'INSTANT WITHDRAW'}
                  </Button>
                </div>
                <p className="text-xs text-warning mt-4 text-center">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  Early withdrawal forfeits future yields
                </p>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Queue State */}
      <Dialog open={transactState === 'queued'} onOpenChange={() => setWithLog('idle')}>
        <DialogContent className="glass-card border-white/10 sm:max-w-md rounded-3xl p-8">
          <div className="flex flex-col items-center text-center space-y-6 py-6">
            <div className="rounded-full bg-primary/20 p-6 animate-bounce">
              <Clock className="h-10 w-10 text-primary" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">Withdrawal Queued</DialogTitle>
            </DialogHeader>
            <div className="rounded-3xl bg-white/5 border border-white/5 p-6 w-full space-y-4 shadow-inner">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Queue Position</span>
                <span className="font-black text-primary text-lg">#3</span>
              </div>
              <div className="h-[1px] bg-white/5 w-full" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground font-medium">Estimated Wait</span>
                <span className="font-black text-white">~2 hours</span>
              </div>
            </div>
            <Button variant="outline" onClick={() => setWithLog('idle')} className="rounded-2xl border-white/10 w-full py-6 font-bold hover:bg-white/5 transition-all">
              Return to Portfolio
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
