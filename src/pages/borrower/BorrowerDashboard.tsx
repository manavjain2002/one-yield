import { DashboardLayout } from '@/components/DashboardLayout';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import { useBorrowerDashboardSummary } from '@/hooks/useBorrowerDashboardSummary';
import { useBorrowerDashboardActivePools } from '@/hooks/useBorrowerDashboardActivePools';
import { TransactionList } from '@/components/TransactionList';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { DedicatedWalletsConfig } from './DedicatedWalletsConfig';
import { RepayModal } from '@/components/RepayModal';
import type { Pool } from '@/data/mockData';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLendingPoolRead } from '@/lib/contracts';
import { DollarSign, TrendingUp, AlertTriangle, BarChart3, ChevronDown, ChevronUp, Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AddressLink } from '@/components/AddressLink';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useCreatePool } from '@/hooks/useCreatePool';
import { useWallet } from '@/contexts/WalletContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
export default function BorrowerDashboard() {
  const { data: summary } = useBorrowerDashboardSummary();
  const { data: activePoolRows = [] } = useBorrowerDashboardActivePools();
  const { data: txData, isLoading: isLoadingTxs } = useTransactionHistory(1, 5);
  const [selectedRepayPool, setSelectedRepayPool] = useState<Pool | null>(null);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);
  const [showCreatePool, setShowCreatePool] = useState(false);

  const { role } = useWallet();
  const createPool = useCreatePool();
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [borrowUsd, setBorrowUsd] = useState('');
  const [apyInput, setApyInput] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: tokens = [] } = useQuery({
    queryKey: ['constants', 'tokens'],
    queryFn: async () => {
      const { data } = await api.get<{ symbol: string; name: string; address: string }[]>('/pools/constants/tokens');
      return data;
    },
  });

  const aumPoolIds = activePoolRows.map((r) => r.pool.id).join(',');
  const { data: aumMap = {} } = useQuery({
    queryKey: ['borrower-pool-aum', aumPoolIds],
    queryFn: async () => {
      const result: Record<string, bigint> = {};
      for (const r of activePoolRows) {
        const p = r.pool;
        if (!p.contractAddress || p.contractAddress === p.id) continue;
        try {
          const contract = getLendingPoolRead(p.contractAddress);
          result[p.id] = await contract.assetUnderManagement();
        } catch {
          result[p.id] = 0n;
        }
      }
      return result;
    },
    enabled: activePoolRows.length > 0,
    refetchInterval: 30000,
  });

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Pool Name is required.'); return; }
    if (!symbol.trim()) { toast.error('Symbol is required.'); return; }
    const usd = parseInt(borrowUsd, 10);
    if (!usd || usd <= 0) { toast.error('Enter a valid integer amount'); return; }
    const apyNum = parseFloat(apyInput);
    if (!apyNum || apyNum <= 0 || apyNum > 100) { toast.error('APY must be between 0.01 and 100'); return; }
    const bps = Math.round(apyNum * 100);
    const poolSizeWei = String(usd * 1_000_000);
    if (!file) {
      toast.error('Upload Loan Tape is required.');
      return;
    }
    try {
      await createPool.mutateAsync({ name, symbol, poolSize: poolSizeWei, apyBasisPoints: bps, poolTokenAddress: tokenAddress, file });
      setShowCreatePool(false);
      setName(''); setSymbol(''); setBorrowUsd(''); setApyInput(''); setFile(null);
    } catch {}
  };

  const poolTokenLabel = (p: Pool) => p.poolTokenName || 'USDC';
  const poolsForLabel = activePoolRows.map((r) => r.pool);
  const summaryTokenLabel =
    poolsForLabel.length === 0
      ? 'USDC'
      : [...new Set(poolsForLabel.map(poolTokenLabel))].length === 1
        ? poolTokenLabel(poolsForLabel[0])
        : 'USDC';
  const fmtTok = (n: number) =>
    `${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${summaryTokenLabel}`;

  const totalPrincipal = summary?.outstandingPrincipalNominal ?? 0;
  console.log('totalPrincipal', totalPrincipal);
  const totalCoupon = summary?.outstandingCouponNominal ?? 0;
  console.log('totalCoupon', totalCoupon);
  const totalOutstanding = summary?.totalDebtNominal ?? 0;
  console.log('totalOutstanding', totalOutstanding);
  const activePoolCount = summary?.activePoolCount ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter">Borrower Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Monitor your debt positions and pool activity</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <div><MetricCard title="Outstanding Principal" value={fmtTok(totalPrincipal)} icon={<DollarSign className="h-5 w-5" />} /></div>
            </TooltipTrigger>
            <TooltipContent><p className="max-w-xs text-xs">Total pool token borrowed minus repaid across all your pools (child allocations), in {summaryTokenLabel}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><MetricCard title="Outstanding Coupon" value={fmtTok(totalCoupon)} icon={<TrendingUp className="h-5 w-5" />} /></div>
            </TooltipTrigger>
            <TooltipContent><p className="max-w-xs text-xs">Estimated interest on outstanding principal, in {summaryTokenLabel}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><MetricCard title="Total Debt" value={fmtTok(totalOutstanding)} icon={<AlertTriangle className="h-5 w-5" />} /></div>
            </TooltipTrigger>
            <TooltipContent><p className="max-w-xs text-xs">Principal plus estimated coupon, in {summaryTokenLabel}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><MetricCard title="Active Pools" value={String(activePoolCount)} icon={<BarChart3 className="h-5 w-5" />} /></div>
            </TooltipTrigger>
            <TooltipContent><p className="max-w-xs text-xs">Number of pools with outstanding debt positions</p></TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold">My Active Pools</h2>
            <Link to="/borrower/pools" className="text-sm font-bold text-primary hover:text-primary/80 transition-all">
              View All Pools →
            </Link>
          </div>

          <div className="space-y-3">
            {activePoolRows.length > 0 ? activePoolRows.map((row) => {
              const { pool, totalOutstandingNominal, totalDeployedNominal, totalRepaidNominal } = row;
              const isExpanded = expandedPoolId === pool.id;
              const outstanding = totalOutstandingNominal;
              const poolAum = aumMap[pool.id] ?? 0n;
              const hasAum = poolAum > 0n;
              const nominalPoolSize = Number(pool.poolSize) / 1e6;
              const tok = poolTokenLabel(pool);

              return (
                <div key={pool.id} className="glass-card rounded-2xl overflow-hidden border border-border/40 transition-all hover:border-primary/20 group">
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:flex-nowrap">
                    <div className="flex items-center gap-4 min-w-[180px]">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-bold group-hover:scale-110 transition-transform">
                        {pool.symbol[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{pool.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">{pool.symbol}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-8 flex-1 justify-evenly sm:justify-start text-sm">
                      <div className="text-center sm:text-left min-w-[100px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Pool Size</p>
                        <p className="font-bold">{nominalPoolSize.toLocaleString()} {tok}</p>
                      </div>
                      <div className="text-center sm:text-left min-w-[100px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">APR</p>
                        <p className="font-bold text-success">{pool.apy}%</p>
                      </div>
                      <div className="text-center sm:text-left min-w-[100px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Status</p>
                        <StatusBadge status={pool.status} />
                      </div>
                      <div className="text-center sm:text-left min-w-[100px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Outstanding</p>
                        <p className="font-bold text-destructive">
                          {outstanding.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
                          {tok}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                        className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl gradient-primary font-bold px-6 shadow-md glow-primary"
                        disabled={!hasAum || outstanding <= 0}
                        onClick={() => setSelectedRepayPool(pool)}
                      >
                        Repay
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-border/20 bg-primary/[0.02] animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 py-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pool Token</p>
                          <p className="text-sm font-medium">{pool.poolTokenName || 'USDC'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Token Address</p>
                          <AddressLink address={pool.poolTokenAddress || ''} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Funded</p>
                          <p className="text-sm font-bold">
                            {totalDeployedNominal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tok}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Repaid</p>
                          <p className="text-sm font-bold text-success">
                            {totalRepaidNominal.toLocaleString(undefined, { maximumFractionDigits: 2 })} {tok}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pool Size</p>
                          <p className="text-sm font-medium">{nominalPoolSize.toLocaleString()} {tok}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">APR</p>
                          <p className="text-sm font-bold text-success">{pool.apy}%</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pool Contract</p>
                          <AddressLink address={pool.contractAddress} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">LP Token</p>
                          <AddressLink address={pool.lpTokenAddress || pool.contractAddress} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">LP Token Name</p>
                          <p className="text-sm font-medium">{pool.lpTokenName || `${pool.symbol} LP`}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="py-16 text-center glass-card rounded-2xl border-dashed border-border/50 space-y-4">
                <Clock className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-muted-foreground">
                  {activePoolCount === 0 && (summary?.outstandingPrincipalNominal ?? 0) > 0
                    ? 'No active or pending pools. View all pools for paused or closed positions.'
                    : 'No active pools found.'}
                </p>
                <Button onClick={() => setShowCreatePool(true)} className="gradient-primary rounded-xl font-bold px-6 shadow-md">
                  <Plus className="h-4 w-4 mr-2" /> Create Pool
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-bold">Recent Activity</h2>
              <Link to="/borrower/history" className="text-sm font-medium text-primary hover:underline">View All</Link>
            </div>
            <div className="glass-card rounded-2xl p-4 overflow-hidden shadow-xl">
              <TransactionList transactions={txData?.items || []} isLoading={isLoadingTxs} />
            </div>
          </div>
          <div>
            <DedicatedWalletsConfig />
          </div>
        </div>
      </div>

      {selectedRepayPool && (
        <RepayModal
          isOpen={!!selectedRepayPool}
          onClose={() => setSelectedRepayPool(null)}
          poolId={selectedRepayPool.id}
          poolName={selectedRepayPool.name}
          symbol={selectedRepayPool.poolTokenName || 'USDC'}
          poolTokenAddress={selectedRepayPool.poolTokenAddress}
          fundManagerAddress={selectedRepayPool.fundManagerAddress}
          borrowerPools={selectedRepayPool.borrowerPools || []}
        />
      )}

      <Dialog open={showCreatePool} onOpenChange={setShowCreatePool}>
        <DialogContent className="glass-card border-border/50 sm:max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle className="text-xl font-bold">Create New Pool</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pool Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. ALPHA FUND" value={name} onChange={e => setName(e.target.value.toUpperCase())} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Symbol <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. ALPHA" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Accepted Token <span className="text-destructive">*</span></Label>
              <SearchableSelect options={[{ value: '', label: 'Default USDC' }, ...tokens.map(t => ({ value: t.address, label: `${t.name} (${t.symbol})`, description: `${t.address.slice(0, 8)}...${t.address.slice(-6)}` }))]} value={tokenAddress} onChange={setTokenAddress} placeholder="Select Token (Default USDC)" />
            </div>
            <div className="space-y-2">
              <Label>Borrow Amount <span className="text-destructive">*</span></Label>
              <Input type="number" inputMode="numeric" step="1" value={borrowUsd} onChange={e => { const v = e.target.value; if (!v || /^\d+$/.test(v)) setBorrowUsd(v); }} placeholder="500000" className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Projected APY (%) <span className="text-destructive">*</span></Label>
              <Input type="text" inputMode="decimal" value={apyInput} onChange={e => setApyInput(e.target.value)} placeholder="e.g., 8.5" className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Upload Loan Tape <span className="text-destructive">*</span></Label>
              <Input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] || null)} className="bg-secondary/50 border-border file:text-primary file:font-medium" />
              <p className="text-xs text-muted-foreground">Required. Accepted: .xlsx, .xls, .csv</p>
            </div>
            <Button type="button" className="w-full gradient-primary rounded-xl mt-2" disabled={createPool.isPending || !name.trim() || !symbol.trim() || !borrowUsd || !apyInput || !file} onClick={() => void handleCreate()}>
              {createPool.isPending ? 'Submitting...' : 'Create Pool'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
