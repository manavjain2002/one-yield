import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useBorrowerMyPools } from '@/hooks/useBorrowerMyPools';
import { useCreatePool } from '@/hooks/useCreatePool';
import { useWallet } from '@/contexts/WalletContext';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronUp, ExternalLink, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage, isApiConfigured } from '@/lib/api';
import { RepayModal } from '@/components/RepayModal';
import type { Pool } from '@/data/mockData';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

function usdToMockUsdcAtomic(usd: string): string {
  const n = Number(String(usd).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Enter a valid borrow amount (USD)');
  }
  return BigInt(Math.round(n * 1_000_000)).toString();
}

export default function BorrowerPools() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [borrowUsd, setBorrowUsd] = useState('');
  const [apy, setApy] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [expandedPoolId, setExpandedPoolId] = useState<string | null>(null);

  // Repay Modal State
  const [selectedRepayPool, setSelectedRepayPool] = useState<Pool | null>(null);

  const { data: tokens = [] } = useQuery({
    queryKey: ['constants', 'tokens'],
    queryFn: async () => {
      const { data } = await api.get<{ symbol: string; name: string; address: string }[]>('/pools/constants/tokens');
      return data;
    },
  });

  const { data: myPoolRows = [], isLoading, refetch } = useBorrowerMyPools();
  const { role } = useWallet();
  const createPool = useCreatePool();
  const { isConnected: isWeb3Connected } = useAccount();
  const { openConnectModal } = useConnectModal();

  // Backend returns only the logged-in borrower's pools — no client-side wallet filter needed
  const borrowerPools = myPoolRows;

  const handleCreate = async () => {
    if (!isApiConfigured()) {
      toast.error('Backend API not reachable.');
      return;
    }
    if (role !== 'borrower') {
      toast.error('Switch to Borrower role to create a pool.');
      return;
    }
    try {
      if (!name.trim()) {
        toast.error('Pool Name is required.');
        return;
      }
      if (!symbol.trim()) {
        toast.error('Symbol is required.');
        return;
      }
      const poolSize = usdToMockUsdcAtomic(borrowUsd);
      const apyNum = parseFloat(apy);
      if (!Number.isFinite(apyNum) || apyNum <= 0 || apyNum > 100) {
        toast.error('Enter a valid APY between 0.01% and 100%.');
        return;
      }
      const apyBasisPoints = Math.round(apyNum * 100);
      if (!file) {
        toast.error('Upload Loan Tape is required.');
        return;
      }
      await createPool.mutateAsync({
        name: name.trim().toUpperCase(),
        symbol: symbol.trim().toUpperCase(),
        poolSize,
        apyBasisPoints,
        poolTokenAddress: tokenAddress || undefined,
        file,
      });
      toast.success('Pool creation initiated — please wait for confirmation.');
      setShowCreate(false);
      setName('');
      setSymbol('');
      setBorrowUsd('');
      setApy('');
      setFile(null);
      void refetch();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Pools</h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">Create and manage your debt positions</p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gradient-primary rounded-xl px-6 font-bold shadow-md glow-primary transition-all active:scale-95"
            disabled={role !== 'borrower' || createPool.isPending}
          >
            <Plus className="mr-2 h-4 w-4" /> Create Pool
          </Button>
        </div>

        <div className="space-y-3">
          {borrowerPools.length > 0 ? (
            borrowerPools.map((row) => {
              const { pool, debtOwedPrincipalNominal, couponAmountNominal, principalRepaidNominal } = row;
              const isExpanded = expandedPoolId === pool.id;
              const nominalPoolSize = Number(pool.poolSize) / 1e6;
              const hasDebtToRepay = debtOwedPrincipalNominal + couponAmountNominal > 0;

              return (
                <div key={pool.id} className="glass-card rounded-2xl overflow-hidden border border-border/40 transition-all hover:border-primary/20">
                  {/* Main Row */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:flex-nowrap">
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-inner text-sm">
                        {pool.symbol[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm uppercase tracking-wide">{pool.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">{pool.contractAddress.slice(0, 6)}...{pool.contractAddress.slice(-4)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-8 flex-1 justify-center sm:justify-start font-mono text-sm font-bold text-center sm:text-left">
                      <div className="min-w-[100px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Debt Owed</p>
                        <p className="text-foreground">
                          ${debtOwedPrincipalNominal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="min-w-[80px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Coupon</p>
                        <p className="text-primary/70">
                          ${couponAmountNominal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="min-w-[100px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Principal Repaid</p>
                        <p className="text-success">
                          ${principalRepaidNominal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="min-w-[60px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">APY</p>
                        <p className="text-success">{pool.apy}%</p>
                      </div>
                      <div className="min-w-[80px]">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter mb-1">Status</p>
                        <StatusBadge status={pool.status} />
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedPoolId(isExpanded ? null : pool.id)}
                        className="rounded-xl flex-1 sm:flex-none text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                        Details
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!isWeb3Connected) {
                            openConnectModal?.();
                            return;
                          }
                          setSelectedRepayPool(pool);
                        }}
                        className={`flex-1 sm:flex-none rounded-xl font-bold px-8 shadow-md transition-all active:scale-95 ${!isWeb3Connected
                          ? 'bg-secondary text-muted-foreground border border-border/50'
                          : 'gradient-primary glow-primary'
                          }`}
                        disabled={isWeb3Connected && !hasDebtToRepay}
                      >
                        {!isWeb3Connected ? (
                          <><Wallet className="w-3 h-3 mr-1.5" />Connect to Repay</>
                        ) : 'Repay'}
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-border/20 bg-primary/[0.02] animate-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">Pool Size</p>
                          <p className="text-xs font-bold text-foreground/80">${nominalPoolSize.toLocaleString()}M</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">Principal Repaid</p>
                          <p className="text-xs font-bold text-success">
                            ${principalRepaidNominal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] text-muted-foreground uppercase font-black">Contract Address</p>
                          <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => window.open(`https://hashscan.io/testnet/address/${pool.contractAddress}`, '_blank')}>
                            <p className="text-[10px] font-mono text-muted-foreground group-hover:text-primary">{pool.contractAddress.slice(0, 10)}...</p>
                            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : !isLoading && (
            <div className="py-20 text-center text-muted-foreground italic glass-card rounded-2xl border-dashed border-border/50">
              No pools yet. Create one to get started.
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="glass-card border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Your Pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pool Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. ALPHA FUND"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. ALPHA"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Accepted token <span className="text-destructive">*</span></Label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Default USDC' },
                  ...tokens.map(t => ({ value: t.address, label: `${t.name} (${t.symbol})`, description: `${t.address.slice(0, 8)}...${t.address.slice(-6)}` })),
                ]}
                value={tokenAddress}
                onChange={setTokenAddress}
                placeholder="Select Token (Default USDC)"
              />
            </div>
            <div className="space-y-2">
              <Label>Borrow Amount <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                inputMode="numeric"
                step="1"
                value={borrowUsd}
                onChange={(e) => { const v = e.target.value; if (!v || /^\d+$/.test(v)) setBorrowUsd(v); }}
                placeholder="500000"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Projected APY (%) <span className="text-destructive">*</span></Label>
              <Input
                type="text"
                inputMode="decimal"
                value={apy}
                onChange={(e) => setApy(e.target.value)}
                placeholder="e.g., 8.5"
                className="bg-secondary/50 border-border"
              />
              <p className="text-xs text-muted-foreground">
                Annual Percentage Yield offered to lenders. Stored as basis points (8.5% → 850 bps).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Upload Loan Tape <span className="text-destructive">*</span></Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="bg-secondary/50 border-border file:text-primary file:font-medium"
              />
              <p className="text-xs text-muted-foreground">Required. Accepted: .xlsx, .xls, .csv</p>
            </div>
            <Button
              type="button"
              className="w-full gradient-primary rounded-xl mt-2"
              disabled={createPool.isPending || !name.trim() || !symbol.trim() || !borrowUsd || !apy || !file}
              onClick={() => void handleCreate()}
            >
              {createPool.isPending ? 'Submitting…' : 'Create Pool'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedRepayPool && (
        <RepayModal
          isOpen={!!selectedRepayPool}
          onClose={() => setSelectedRepayPool(null)}
          poolId={selectedRepayPool.id}
          poolName={selectedRepayPool.name}
          symbol={selectedRepayPool.poolTokenName || 'USDC'}
          poolTokenAddress={selectedRepayPool.poolTokenAddress}
          fundManagerAddress={selectedRepayPool.fundManagerAddress}
          borrowerPools={selectedRepayPool.borrowerPools}
        />
      )}

    </DashboardLayout>
  );
}
