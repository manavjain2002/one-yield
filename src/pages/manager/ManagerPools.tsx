import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { HashScanLink } from '@/components/HashScanLink';
import type { Pool } from '@/data/mockData';
import { useManagerSummary } from '@/hooks/useManagerSummary';
import { useManagerActions } from '@/hooks/useManagerActions';
import { usePoolTxHistory } from '@/hooks/useTxHistory';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLendingPoolRead, getAssetManagerRead } from '@/lib/contracts';
import { useSearchParams } from 'react-router-dom';
import { ChildPoolsManager } from './ChildPoolsManager';
import { ChevronDown } from 'lucide-react';

const COLORS = ['hsl(230, 80%, 60%)', 'hsl(142, 71%, 45%)', 'hsl(250, 80%, 65%)'];

export default function ManagerPools() {
  const { data: summary } = useManagerSummary();
  const pools = summary?.poolsUi ?? [];
  const [searchParams] = useSearchParams();
  const initialPoolId = searchParams.get('poolId');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const actions = useManagerActions();

  useEffect(() => {
    if (!pools.length) {
      setSelectedPool(null);
      return;
    }
    setSelectedPool((prev) => {
      if (initialPoolId) {
        const p = pools.find(x => x.id === initialPoolId);
        if (p) return p;
      }
      if (prev && pools.some((p) => p.id === prev.id)) return prev;
      return pools[0];
    });
  }, [pools, initialPoolId]);

  const { data: onChain, isFetching: isFetchingOnChain, refetch: refetchOnChain } = useQuery({
    queryKey: ['pool-onchain', selectedPool?.contractAddress, selectedPool?.fundManagerAddress],
    queryFn: async () => {
      if (!selectedPool?.contractAddress || !selectedPool?.fundManagerAddress) return { totalAssets: 0n, aum: 0n };
      const poolContract = getLendingPoolRead(selectedPool.contractAddress);
      const fmContract = getAssetManagerRead(selectedPool.fundManagerAddress);
      const [ta, aum] = await Promise.all([
        poolContract.totalAssets(),
        poolContract.assetUnderManagement(),
      ]);
      return { totalAssets: ta, aum: aum };
    },
    enabled: !!selectedPool?.contractAddress && !!selectedPool?.fundManagerAddress,
    refetchInterval: 30000,
  });

  const { data: isPaused, refetch: refetchPaused } = useQuery({
    queryKey: ['pool-paused', selectedPool?.contractAddress],
    queryFn: async () => {
      if (!selectedPool?.contractAddress) return false;
      const contract = getLendingPoolRead(selectedPool.contractAddress);
      return await contract.paused();
    },
    enabled: !!selectedPool?.contractAddress,
  });

  const { data: txHistory = [] } = usePoolTxHistory(selectedPool?.id);

  if (!selectedPool) {
    return (
      <DashboardLayout>
        <div className="p-8 text-muted-foreground">No pools to manage yet.</div>
      </DashboardLayout>
    );
  }

  const ta = onChain?.totalAssets ?? 0n;
  const aum = onChain?.aum ?? 0n;

  // onChain data is raw BigInt, so we divide here.
  const poolFundsNum = ta > aum ? Number(ta - aum) / 1e6 : 0;
  const aumNum = Number(aum) / 1e6;

  const fundsPie = [
    { name: 'In Pool (Liquid)', value: poolFundsNum },
    { name: 'With Fund Manager', value: aumNum },
  ];

  // Map history to tabs with real filtering
  const getFilteredHistory = (tab: string) => {
    switch (tab) {
      case 'deposits':
        return txHistory.filter(tx => ['deposit'].includes(tx.type.toLowerCase()));
      case 'withdrawals':
        return txHistory.filter(tx => ['withdraw', 'redeem'].includes(tx.type.toLowerCase()));
      case 'repayments':
        return txHistory.filter(tx => ['repay', 'repayment'].includes(tx.type.toLowerCase()));
      case 'deployments':
        return txHistory.filter(tx => ['deploy', 'release', 'transfer'].includes(tx.type.toLowerCase()));
      default:
        return txHistory;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Pool Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage fund flows and pool operations</p>
        </div>

        {/* Pool Selector - Refactored for better design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-2 bg-secondary/20 p-6 rounded-2xl border border-border/50 group hover:border-primary/30 transition-all">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Switch Active Management</label>
            <div className="relative">
              <select
                value={selectedPool.id}
                onChange={(e) => {
                  const p = pools.find(x => x.id === e.target.value);
                  if (p) setSelectedPool(p);
                }}
                className="w-full bg-background/50 border border-border/50 rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer hover:bg-background transition-colors"
              >
                {pools.map(pool => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name} ({pool.symbol})
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 flex flex-col justify-center border-l-4 border-l-primary shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Current Status</p>
            <div className="flex items-center gap-2">
              <StatusBadge status={isPaused ? 'paused' : selectedPool.status} />
              <span className="text-xs font-bold text-foreground/80 capitalize">
                {isPaused ? 'Paused' : selectedPool.status}
              </span>
            </div>
          </div>
        </div>

        {/* Pool Overview */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Donut Chart - Shrunk */}
          <div className="glass-card rounded-2xl p-6 flex flex-col items-center">
            <h3 className="text-base font-semibold mb-2 self-start">Fund Distribution</h3>
            <div className="h-48 w-full max-w-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={fundsPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                    {fundsPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 text-xs mt-2 w-full">
              {fundsPie.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between p-2 rounded-xl bg-secondary/20">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-bold">${d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Operations Section 1: Fund Flow */}
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold italic">Section 1: Fund Operations</h3>
              <div className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">ACTIVE ACTIONS</div>
            </div>
            
            <div className="grid gap-3">
              {/* PRIMARY ACTION: Deploy */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Deploy Funds</p>
                  <span className="text-[10px] font-mono text-muted-foreground">Release to Borrowers</span>
                </div>
                <Button
                  className="w-full gradient-primary shadow-lg glow-primary font-bold h-10 rounded-xl"
                  disabled={aum === 0n || actions.releaseToBorrowers.isPending}
                  onClick={() => actions.releaseToBorrowers.mutate(selectedPool)}
                >
                  {actions.releaseToBorrowers.isPending ? 'Deploying...' : `Deploy $${aumNum.toLocaleString()} to Borrowers`}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Sweep */}
                <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transfer to Reserve</p>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-[10px] h-9 font-bold border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    disabled={ta <= aum || actions.sweepToFundManager.isPending}
                    onClick={() => actions.sweepToFundManager.mutate({ pool: selectedPool, amount: (ta > aum ? ta - aum : 0n) as bigint })}
                  >
                    Sweep ${poolFundsNum.toLocaleString()}
                  </Button>
                </div>
                {/* Refill */}
                <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transfer to Available</p>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl text-[10px] h-9 font-bold border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    disabled={aum === 0n || actions.refillPool.isPending}
                    onClick={() => {
                      const maxAumStr = aumNum.toLocaleString();
                      const amt = window.prompt(`Enter amount to refill (USDC). Available in Fund Manager: $${maxAumStr}`, "1.0");
                      if (amt) actions.refillPool.mutate({ pool: selectedPool, amount: BigInt(Math.floor(parseFloat(amt) * 1e6)) });
                    }}
                  >
                    Refill Pool
                  </Button>
                </div>
              </div>
            </div>

            {/* Pool Status Toggle / Action Section */}
            <div className="pt-2 border-t border-border/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold italic">Safety Controls</span>
                <div className="bg-destructive/10 text-destructive text-[8px] px-2 py-0.5 rounded-full font-black">RISK MGMT</div>
              </div>
              
              <div className="flex gap-2">
                {selectedPool.status === 'pending' ? (
                  <Button
                    className="w-full gradient-primary shadow-lg glow-primary font-bold h-11 rounded-xl"
                    disabled={actions.activatePool.isPending}
                    onClick={() => actions.activatePool.mutate(selectedPool)}
                  >
                    {actions.activatePool.isPending ? 'Activating...' : '🚀 Activate & Initialize Pool'}
                  </Button>
                ) : (
                  <>
                    {isPaused ? (
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl text-xs border-success text-success hover:bg-success/10 font-bold h-11"
                        disabled={actions.unpausePool.isPending}
                        onClick={() => actions.unpausePool.mutate(selectedPool, { onSuccess: () => refetchPaused() })}
                      >
                        Unpause Pool
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        className="flex-1 rounded-xl text-xs font-bold h-11"
                        disabled={actions.pausePool.isPending}
                        onClick={() => actions.pausePool.mutate(selectedPool, { onSuccess: () => refetchPaused() })}
                      >
                        Pause Pool
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl text-xs border-destructive/30 text-destructive hover:bg-destructive/10 font-bold h-11"
                      disabled={actions.closePool.isPending || selectedPool.status === 'closed'}
                      onClick={() => {
                        if (window.confirm('Are you sure you want to CLOSE this pool? This is irreversible.')) {
                          actions.closePool.mutate(selectedPool);
                        }
                      }}
                    >
                      {selectedPool.status === 'closed' ? 'Closed' : 'Close Pool'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-base font-semibold mb-3">Quick Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Pool Size</span>
              <span className="font-semibold text-white">${selectedPool.totalRequested.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Deposited (DB)</span>
              <span className="font-semibold text-white">${selectedPool.totalReceived.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pool APY</span>
              <span className="font-semibold text-success">{selectedPool.apy}%</span>
            </div>
          </div>
        </div>

        {/* Child Pools Management */}
        <ChildPoolsManager pool={selectedPool} />

        {/* History Tabs */}
        <Tabs defaultValue="deposits" className="space-y-4">
          <TabsList className="bg-secondary/50 rounded-xl">
            <TabsTrigger value="deposits" className="rounded-lg">Deposits</TabsTrigger>
            <TabsTrigger value="withdrawals" className="rounded-lg">Withdrawals</TabsTrigger>
            <TabsTrigger value="repayments" className="rounded-lg">Repayments</TabsTrigger>
            <TabsTrigger value="deployments" className="rounded-lg">Deployments</TabsTrigger>
          </TabsList>
          {['deposits', 'withdrawals', 'repayments', 'deployments'].map(tab => (
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
                  <tbody className="divide-y divide-white/5">
                    {getFilteredHistory(tab).length > 0 ? (
                      getFilteredHistory(tab).map(tx => (
                        <tr key={tx.id} className="border-b border-border/30 last:border-0 hover:bg-white/[0.02] transition-colors group">
                          <td className="px-4 py-3 capitalize font-semibold group-hover:text-primary transition-colors">{tx.type}</td>
                          <td className="px-4 py-3 font-semibold text-white">${tx.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</td>
                          <td className="px-4 py-3 hidden sm:table-cell"><HashScanLink txHash={tx.txHash} /></td>
                          <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground italic bg-secondary/10 border border-dashed border-border rounded-xl">
                          No Txs found
                        </td>
                      </tr>
                    )}
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
