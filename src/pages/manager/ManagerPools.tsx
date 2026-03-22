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
import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { getLendingPoolRead, getAssetManagerRead, getERC20Read } from '@/lib/contracts';
import { useSearchParams } from 'react-router-dom';
import { ChildPoolsManager } from './ChildPoolsManager';
import { Loader2 } from 'lucide-react';
import { useTransaction } from '@/contexts/TransactionContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function ManagerPools() {
  const { data: summary } = useManagerSummary();
  const pools = summary?.poolsUi ?? [];
  const [searchParams] = useSearchParams();
  const initialPoolId = searchParams.get('poolId');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const actions = useManagerActions();
  const { startTransaction, endTransaction } = useTransaction();

  const [sweepAmount, setSweepAmount] = useState('');
  const [refillAmount, setRefillAmount] = useState('');

  useEffect(() => {
    if (!pools.length) { setSelectedPool(null); return; }
    setSelectedPool((prev) => {
      const targetId = initialPoolId || prev?.id;
      const fresh = pools.find(p => p.id === targetId);
      return fresh ?? pools[0];
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

  const { data: totalAllocationOnChain = 0 } = useQuery({
    queryKey: ['total-allocation', selectedPool?.fundManagerAddress],
    queryFn: async () => {
      if (!selectedPool?.fundManagerAddress) return 0;
      const fm = getAssetManagerRead(selectedPool.fundManagerAddress);
      const val = await fm.totalAllocation();
      return Number(val);
    },
    enabled: !!selectedPool?.fundManagerAddress,
    refetchInterval: 15000,
  });

  const isAllocationComplete = totalAllocationOnChain === 10000;
  const poolTokenName = selectedPool?.poolTokenName || 'USDC';

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
    const t = (s: string) => s.toLowerCase();
    switch (tab) {
      case 'deposits':
        return txHistory.filter((tx) => t(tx.type) === 'deposit');
      case 'withdrawals':
        return txHistory.filter((tx) => ['withdraw', 'redeem'].includes(t(tx.type)));
      case 'repayments':
        return txHistory.filter((tx) => ['repay', 'repayment'].includes(t(tx.type)));
      case 'deployments':
        return txHistory.filter((tx) =>
          [
            'deploy_funds',
            'send_to_reserve',
            'create_pool',
            'activate',
            'pause',
            'unpause',
            'aum_update',
          ].includes(t(tx.type)),
        );
      default:
        return txHistory;
    }
  };


  const isPoolPending = selectedPool.status === 'pending';
  const isPoolClosed = selectedPool.status === 'closed';

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
          <div className="glass-card rounded-2xl p-6 flex flex-col border border-border/50">
            <h3 className="text-base font-semibold mb-4 text-center sm:text-left">Fund Distribution</h3>
            <div className="flex-1 min-h-[220px] flex items-center justify-center">
              {totalFunds > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Liquid', value: poolFundsNum },
                        { name: 'Fund Manager', value: aumNum },
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="hsl(var(--primary))" />
                      <Cell fill="hsl(var(--success))" />
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(val: number) => `$${val.toLocaleString()}`}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-muted-foreground italic text-sm text-center py-20">No funds in pool</div>
              )}
            </div>
            <div className="space-y-3 text-sm pt-4 border-t border-border/30 mt-auto">
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

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transfer to Reserve (Sweep) — {poolTokenName}</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        placeholder={`Amount (${poolTokenName})`}
                        value={sweepAmount}
                        onChange={e => setSweepAmount(e.target.value)}
                        className="h-9 text-sm bg-secondary/30 pr-14"
                      />
                      <button
                        type="button"
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transfer to Available (Refill) — {poolTokenName}</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="number"
                        placeholder={`Amount (${poolTokenName})`}
                        value={refillAmount}
                        onChange={e => setRefillAmount(e.target.value)}
                        className="h-9 text-sm bg-secondary/30 pr-14"
                      />
                      <button
                        type="button"
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

              <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-primary">Deploy Funds</p>
                    <p className="text-xs text-muted-foreground mt-1">Release funds from manager reserve to borrower sub-pools.</p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">ON-CHAIN ACTION</span>
                </div>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block">
                      <Button
                        className="w-full gradient-primary shadow-lg glow-primary font-bold h-12 rounded-xl"
                        disabled={aumNum === 0 || actions.releaseToBorrowers.isPending || isPoolPending || isPoolClosed || !isAllocationComplete}
                        onClick={() => { startTransaction('Deploying funds...'); actions.releaseToBorrowers.mutateAsync(selectedPool).then(() => { void refetchBalances(); }).finally(endTransaction); }}
                      >
                        {actions.releaseToBorrowers.isPending ? 'Deploying...' : `Deploy ${aumNum.toLocaleString()} ${poolTokenName}`}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {!isAllocationComplete ? 'Allocation must total 100% before deploying' : aumNum === 0 ? 'No funds available to deploy' : 'Release funds to borrower wallets'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {isPoolPending && (
            <div className="pt-6 border-t border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-sm font-bold">Pool Initialization</span>
                  <p className="text-xs text-muted-foreground">Activate the pool to enable lending and borrowing.</p>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block">
                    <Button
                      className="w-full gradient-primary shadow-lg glow-primary font-bold h-11 rounded-xl"
                      disabled={actions.activatePool.isPending || !selectedPool.contractAddress}
                      onClick={() => {
                        startTransaction('Activating pool...');
                        actions.activatePool.mutateAsync(selectedPool).finally(endTransaction);
                      }}
                    >
                      {actions.activatePool.isPending ? 'Activating...' : 'Activate & Initialize Pool'}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {!selectedPool.contractAddress ? 'Waiting for on-chain deployment' : 'Set pool to active status'}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
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
