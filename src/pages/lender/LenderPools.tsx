import { DashboardLayout } from '@/components/DashboardLayout';
import { RiskBadge, StatusBadge } from '@/components/StatusBadge';
import { usePoolsList } from '@/hooks/usePools';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { Pool } from '@/data/mockData';
import { useLenderActions } from '@/hooks/useLenderActions';
import { parseUnits } from 'ethers';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, TrendingUp } from 'lucide-react';

export default function LenderPools() {
  const [depositPool, setDepositPool] = useState<Pool | null>(null);
  const [amount, setAmount] = useState('');
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const { data: pools = [] } = usePoolsList();
  
  const { allowance, approve, deposit, isPaused } = useLenderActions(depositPool);
  
  const activePools = pools.filter(p => p.status === 'active' || p.status === 'paused');
  const expectedYield = amount ? (parseFloat(amount) * (depositPool?.apy || 0) / 100).toFixed(2) : '0.00';

  const amountBN = amount ? parseUnits(amount, 6) : 0n;
  const needsApproval = amountBN > allowance;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Earn Opportunities</h1>
            <p className="text-sm text-muted-foreground mt-1">Deploy capital into verified RWA pools</p>
          </div>
        </div>

        <div className="space-y-3">
          {activePools.length > 0 ? (
            activePools.map(pool => {
              const isExpanded = expandedPoolId === pool.id;
              const fillPct = (pool.totalReceived / Number(pool.poolSize) * 1e6) * 100; // Corrected math if poolSize is nominal
              // Actually poolSize is raw string, so Number(pool.poolSize)/1e6 is nominal.
              // Let's use mapApiPoolToUi values if possible, but usePoolsList returns Pool[]
              const nominalPoolSize = Number(pool.poolSize) / 1e6;
              const actualFillPct = (pool.totalReceived / nominalPoolSize) * 100;

              return (
                <div key={pool.id} className="glass-card rounded-2xl overflow-hidden border border-border/40 transition-all hover:border-primary/20">
                  {/* Main Row */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:flex-nowrap">
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-inner">
                        {pool.symbol[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">{pool.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">{pool.contractAddress.slice(0, 6)}...{pool.contractAddress.slice(-4)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-8 flex-1 justify-center sm:justify-start font-mono">
                      <div className="text-center sm:text-left min-w-[80px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">Pool Size</p>
                        <p className="text-sm font-bold text-foreground">${nominalPoolSize.toLocaleString()}M</p>
                      </div>
                      <div className="text-center sm:text-left min-w-[60px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">APR</p>
                        <p className="text-sm font-bold text-success">{pool.apy}%</p>
                      </div>
                      <div className="text-center sm:text-left min-w-[80px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter mb-1">Risk</p>
                        <RiskBadge level={pool.riskLevel} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                        className="rounded-xl flex-1 sm:flex-none text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                        Details
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => { setDepositPool(pool); setAmount(''); }}
                        className="flex-1 sm:flex-none rounded-xl gradient-primary font-bold px-8 shadow-md glow-primary transition-all active:scale-95"
                        disabled={pool.status === 'paused'}
                      >
                        {pool.status === 'paused' ? 'Paused' : 'Transact'}
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-border/20 bg-primary/[0.02] animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">LP Token Name</p>
                          <p className="text-xs font-bold text-foreground/80">{pool.lpTokenName || `OneYield ${pool.symbol} LP`}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">LP Token Address</p>
                          <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => window.open(`https://hashscan.io/testnet/address/${pool.lpTokenAddress || pool.contractAddress}`, '_blank')}>
                            <p className="text-[10px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
                              {pool.lpTokenAddress ? `${pool.lpTokenAddress.slice(0, 10)}...${pool.lpTokenAddress.slice(-4)}` : '0.0.12345...'}
                            </p>
                            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Address</p>
                          <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => window.open(`https://hashscan.io/testnet/address/${pool.contractAddress}`, '_blank')}>
                            <p className="text-[10px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
                              {pool.contractAddress ? `${pool.contractAddress.slice(0, 10)}...${pool.contractAddress.slice(-4)}` : 'N/A'}
                            </p>
                            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Token</p>
                          <p className="text-xs font-bold text-foreground/80">{pool.poolTokenName || 'USDC'}</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-border/10">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider mb-2">
                          <span className="text-muted-foreground">Pool Liquidity Progress</span>
                          <span className="text-primary">{actualFillPct.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary/30">
                          <div className="h-full rounded-full gradient-primary shadow-[0_0_10px_rgba(139,92,246,0.2)] transition-all duration-1000" style={{ width: `${actualFillPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-20 text-center text-muted-foreground italic glass-card rounded-2xl border-dashed border-border/50">
              No active pools found for investment.
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal - Re-using the premium theme */}
      <Dialog open={!!depositPool} onOpenChange={() => {
        if (!approve.isPending && !deposit.isPending) {
          setDepositPool(null);
        }
      }}>
        <DialogContent className="glass-card border-white/10 sm:max-w-md rounded-[2.5rem] p-10 overflow-hidden shadow-[0_0_100px_rgba(139,92,246,0.15)]">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
          
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-3xl font-black tracking-tight mb-1">
              Deposit <span className="text-primary font-black">{depositPool?.name}</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-bold tracking-widest uppercase">
              {depositPool?.symbol} · Strategy: Fixed Yield RWA
            </p>
          </DialogHeader>

          <div className="space-y-8 py-6 relative z-10">
            <div className="space-y-4">
              <Label className="uppercase text-[10px] font-black tracking-widest text-muted-foreground ml-1">Deposit Amount (USDC)</Label>
              <div className="relative group">
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  className="bg-white/5 border-white/10 h-20 rounded-3xl text-2xl font-black focus:ring-primary/20 transition-all px-8 pr-20 shadow-inner" 
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-muted-foreground/40 group-focus-within:text-primary transition-colors text-lg">USDC</div>
              </div>
            </div>

            <div className="rounded-[2rem] bg-white/[0.03] border border-white/5 p-8 space-y-4 shadow-xl">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Target Yield</span>
                <span className="text-xl font-black text-success tracking-tighter">${expectedYield} <span className="text-[10px] text-muted-foreground/50">/ yr</span></span>
              </div>
              <div className="h-[1px] bg-white/5" />
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Portfolio APY</span>
                <span className="text-white">{depositPool?.apy}%</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                className={`h-16 w-full rounded-2xl font-black transition-all shadow-2xl ${
                  isPaused || !amount
                    ? 'bg-white/5 text-muted-foreground cursor-not-allowed opacity-40'
                    : 'gradient-primary text-primary-foreground shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02]'
                }`}
                disabled={approve.isPending || deposit.isPending || !amount || isPaused}
                onClick={async () => {
                  try {
                    if (needsApproval) {
                      await approve.mutateAsync(amount);
                    }
                    await deposit.mutateAsync(amount);
                    setDepositPool(null);
                    setAmount('');
                  } catch (e) {
                    // Errors are handled by the toast notifications within the mutation hooks
                  }
                }}
              >
                {isPaused
                  ? 'Paused'
                  : approve.isPending
                  ? 'Approving USDC...'
                  : deposit.isPending
                  ? 'Depositing...'
                  : needsApproval && amount
                  ? `Approve & Deposit`
                  : 'Confirm Deposit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
