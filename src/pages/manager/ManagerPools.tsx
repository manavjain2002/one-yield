import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import type { Pool } from '@/data/mockData';
import { useManagerSummary } from '@/hooks/useManagerSummary';
import { useManagerActions } from '@/hooks/useManagerActions';
import { usePoolTxHistory } from '@/hooks/useTxHistory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HashScanLink } from '@/components/HashScanLink';
import { AddressLink } from '@/components/AddressLink';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLendingPoolRead, getAssetManagerRead, getERC20Read } from '@/lib/contracts';
import { useSearchParams } from 'react-router-dom';
import { ChildPoolsManager } from './ChildPoolsManager';
import { Loader2 } from 'lucide-react';
import { useTransaction } from '@/contexts/TransactionContext';

export default function ManagerPools() {
  const { data: summary } = useManagerSummary();
  const pools = summary?.poolsUi ?? [];
  console.log('pools', pools);
  const [searchParams] = useSearchParams();
  const initialPoolId = searchParams.get('poolId');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  console.log('selectedPool', selectedPool);
  const actions = useManagerActions();
  const { startTransaction, endTransaction } = useTransaction();

  const [sweepAmount, setSweepAmount] = useState('');
  const [refillAmount, setRefillAmount] = useState('');

  useEffect(() => {
    if (!pools.length) { setSelectedPool(null); return; }
    setSelectedPool((prev) => {
      if (initialPoolId) {
        const p = pools.find(x => x.id === initialPoolId);
        if (p) return p;
      }
      if (prev && pools.some((p) => p.id === prev.id)) return prev;
      return pools[0];
    });
  }, [pools, initialPoolId]);

  const { data: onChain, refetch: refetchOnChain } = useQuery({
    queryKey: ['pool-onchain', selectedPool?.contractAddress, selectedPool?.fundManagerAddress],
    queryFn: async () => {
      if (!selectedPool?.contractAddress || !selectedPool?.fundManagerAddress) return { totalAssets: 0n, aum: 0n };
      const poolContract = getLendingPoolRead(selectedPool.contractAddress);
      const [ta, aum] = await Promise.all([
        poolContract.totalAssets(),
        poolContract.assetUnderManagement(),
      ]);
      return { totalAssets: ta, aum };
    },
    enabled: !!selectedPool?.contractAddress && !!selectedPool?.fundManagerAddress,
    refetchInterval: 30000,
  });

  const { data: balances, refetch: refetchBalances } = useQuery({
    queryKey: ['pool-balances', selectedPool?.contractAddress, selectedPool?.fundManagerAddress, selectedPool?.poolTokenAddress],
    queryFn: async () => {
      if (!selectedPool?.contractAddress || !selectedPool?.fundManagerAddress || !selectedPool?.poolTokenAddress) return { poolBalance: 0n, fmBalance: 0n };
      const token = getERC20Read(selectedPool.poolTokenAddress);
      const [poolBal, fmBal] = await Promise.all([
        token.balanceOf(selectedPool.contractAddress),
        token.balanceOf(selectedPool.fundManagerAddress),
      ]);
      return { poolBalance: poolBal, fmBalance: fmBal };
    },
    enabled: !!selectedPool?.contractAddress && !!selectedPool?.poolTokenAddress && !!selectedPool?.fundManagerAddress,
    refetchInterval: 15000,
  });

  const { data: isPaused, refetch: refetchPaused } = useQuery({
    queryKey: ['pool-paused', selectedPool?.contractAddress],
    queryFn: async () => {
      if (!selectedPool?.contractAddress) return false;
      return await getLendingPoolRead(selectedPool.contractAddress).paused();
    },
    enabled: !!selectedPool?.contractAddress,
  });

  const { data: txHistory = [] } = usePoolTxHistory(selectedPool?.id);

  if (!selectedPool) {
    return (<DashboardLayout><div className="p-8 text-muted-foreground">No pools to manage yet.</div></DashboardLayout>);
  }

  const poolFundsNum = Number(balances?.poolBalance ?? 0n) / 1e6;
  const aumNum = Number(balances?.fmBalance ?? 0n) / 1e6;
  const totalFunds = poolFundsNum + aumNum;
  const liquidPct = totalFunds > 0 ? (poolFundsNum / totalFunds) * 100 : 0;

  const poolOptions = pools.map(p => ({
    value: p.id,
    label: `${p.name} (${p.symbol})`,
    description: `Pool: ${p.contractAddress?.slice(0, 6)}...${p.contractAddress?.slice(-4)} | Token: ${p.poolTokenAddress?.slice(0, 6)}...${p.poolTokenAddress?.slice(-4)}`,
  }));

  const getFilteredHistory = (tab: string) => {
    switch (tab) {
      case 'deposits': return txHistory.filter(tx => ['deposit'].includes(tx.type.toLowerCase()));
      case 'withdrawals': return txHistory.filter(tx => ['withdraw', 'redeem'].includes(tx.type.toLowerCase()));
      case 'repayments': return txHistory.filter(tx => ['repay', 'repayment'].includes(tx.type.toLowerCase()));
      case 'deployments': return txHistory.filter(tx => ['deploy', 'release', 'deploy_funds'].includes(tx.type.toLowerCase()));
      default: return txHistory;
    }
  };


  const isPoolPending = selectedPool.status === 'pending';
  const isPoolClosed = selectedPool.status === 'closed';
  const isPoolActive = selectedPool.status === 'active' && !isPaused;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Pool Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage fund flows and pool operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 flex flex-col gap-2 bg-secondary/20 p-6 rounded-2xl border border-border/50">
            <label className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Switch Active Management</label>
            <SearchableSelect
              options={poolOptions}
              value={selectedPool.id}
              onChange={(val) => { const p = pools.find(x => x.id === val); if (p) setSelectedPool(p); }}
              placeholder="Select a pool..."
            />
          </div>
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-center border-l-4 border-l-primary shadow-sm space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selected Pool</p>
            <p className="text-sm font-bold truncate">{selectedPool.name}</p>
            <AddressLink address={selectedPool.contractAddress} />
            <div className="pt-1">
              <StatusBadge status={isPaused ? 'paused' : selectedPool.status} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-semibold">Fund Distribution</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>In Pool (Liquid): ${poolFundsNum.toLocaleString()}</span>
                <span>With Fund Manager: ${aumNum.toLocaleString()}</span>
              </div>
              <div className="h-4 w-full rounded-full bg-secondary/40 overflow-hidden flex">
                <div className="h-full bg-primary transition-all" style={{ width: `${liquidPct}%` }} />
                <div className="h-full bg-success transition-all" style={{ width: `${100 - liquidPct}%` }} />
              </div>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /><span className="text-muted-foreground">Liquid</span></div>
                <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /><span className="text-muted-foreground">Fund Manager</span></div>
              </div>
            </div>
            <div className="space-y-2 text-sm pt-2 border-t border-border/30">
              <div className="flex justify-between"><span className="text-muted-foreground">Target Pool Size</span><span className="font-semibold">${selectedPool.totalRequested.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Deposited</span><span className="font-semibold">${selectedPool.totalReceived.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pool APY</span><span className="font-semibold text-success">{selectedPool.apy}%</span></div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <ChildPoolsManager pool={selectedPool} />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Fund Operations</h3>
            <div className="bg-primary/20 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">ACTIVE ACTIONS</div>
          </div>

          <div className="grid gap-3">
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Deploy Funds</p>
                <span className="text-[10px] font-mono text-muted-foreground">Release to Borrowers</span>
              </div>
              <Button
                className="w-full gradient-primary shadow-lg glow-primary font-bold h-10 rounded-xl"
                disabled={aumNum === 0 || actions.releaseToBorrowers.isPending || isPoolPending || isPoolClosed}
                onClick={() => { startTransaction('Deploying funds...'); actions.releaseToBorrowers.mutateAsync(selectedPool).then(() => { void refetchBalances(); }).finally(endTransaction); }}
              >
                {actions.releaseToBorrowers.isPending ? 'Deploying...' : `Deploy $${aumNum.toLocaleString()}`}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transfer to Reserve (Sweep)</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      placeholder="Amount (USDC)"
                      value={sweepAmount}
                      onChange={e => setSweepAmount(e.target.value)}
                      className="h-9 text-sm bg-secondary/30 pr-14"
                    />
                    <button
                      onClick={() => setSweepAmount(String(poolFundsNum))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-bold hover:underline"
                    >
                      Max
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl text-[10px] h-9 font-bold px-4"
                    disabled={!sweepAmount || Number(sweepAmount) <= 0 || isPoolPending || isPoolClosed}
                    onClick={async () => {
                      const amt = parseFloat(sweepAmount);
                      if (isNaN(amt) || amt <= 0) return;
                      startTransaction('Sweeping funds...');
                      try {
                        await actions.sweepToFundManager.mutateAsync({ pool: selectedPool, amount: BigInt(Math.floor(amt * 1e6)) });
                        setSweepAmount('');
                        void refetchBalances();
                      } finally { endTransaction(); }
                    }}
                  >
                    Sweep
                  </Button>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transfer to Available (Refill)</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      placeholder="Amount (USDC)"
                      value={refillAmount}
                      onChange={e => setRefillAmount(e.target.value)}
                      className="h-9 text-sm bg-secondary/30 pr-14"
                    />
                    <button
                      onClick={() => setRefillAmount(String(aumNum))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-primary font-bold hover:underline"
                    >
                      Max
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-xl text-[10px] h-9 font-bold px-4"
                    disabled={!refillAmount || Number(refillAmount) <= 0 || isPoolPending || isPoolClosed}
                    onClick={async () => {
                      const amt = parseFloat(refillAmount);
                      if (isNaN(amt) || amt <= 0) return;
                      startTransaction('Refilling pool...');
                      try {
                        await actions.refillPool.mutateAsync({ pool: selectedPool, amount: BigInt(Math.floor(amt * 1e6)) });
                        setRefillAmount('');
                        void refetchBalances();
                      } finally { endTransaction(); }
                    }}
                  >
                    Refill
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold">Safety Controls</span>
              <div className="bg-destructive/10 text-destructive text-[8px] px-2 py-0.5 rounded-full font-bold">RISK MGMT</div>
            </div>
            <div className="flex gap-2">
              {isPoolPending ? (
                <Button
                  className="w-full gradient-primary shadow-lg glow-primary font-bold h-11 rounded-xl"
                  disabled={actions.activatePool.isPending}
                  onClick={() => { startTransaction('Activating pool...'); actions.activatePool.mutateAsync(selectedPool).finally(endTransaction); }}
                >
                  {actions.activatePool.isPending ? 'Activating...' : 'Activate & Initialize Pool'}
                </Button>
              ) : isPoolClosed ? (
                <Button variant="outline" className="w-full rounded-xl font-bold h-11" disabled>Pool Closed</Button>
              ) : (
                <>
                  {isPaused ? (
                    <Button
                      variant="outline"
                      className="flex-1 rounded-xl text-xs border-success text-success hover:bg-success/10 font-bold h-11"
                      disabled={actions.unpausePool.isPending}
                      onClick={() => { startTransaction('Unpausing...'); actions.unpausePool.mutateAsync(selectedPool, { onSuccess: () => refetchPaused() }).finally(endTransaction); }}
                    >
                      Unpause Pool
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      className="flex-1 rounded-xl text-xs font-bold h-11"
                      disabled={actions.pausePool.isPending}
                      onClick={() => { startTransaction('Pausing...'); actions.pausePool.mutateAsync(selectedPool, { onSuccess: () => refetchPaused() }).finally(endTransaction); }}
                    >
                      Pause Pool
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl text-xs border-destructive/30 text-destructive hover:bg-destructive/10 font-bold h-11"
                    disabled={actions.closePool.isPending}
                    onClick={() => { if (window.confirm('Are you sure you want to CLOSE this pool? This is irreversible.')) { startTransaction('Closing...'); actions.closePool.mutateAsync(selectedPool).finally(endTransaction); } }}
                  >
                    Close Pool
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

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
                  <tbody className="divide-y divide-border/10">
                    {getFilteredHistory(tab).length > 0 ? (
                      getFilteredHistory(tab).map(tx => (
                        <tr key={tx.id} className="hover:bg-secondary/5 transition-colors">
                          <td className="px-4 py-3 capitalize font-semibold">{tx.type}</td>
                          <td className="px-4 py-3 font-semibold">${tx.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(tx.timestamp).toLocaleDateString()}</td>
                          <td className="px-4 py-3 hidden sm:table-cell"><HashScanLink txHash={tx.txHash} /></td>
                          <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground italic">No transactions found</td></tr>
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
