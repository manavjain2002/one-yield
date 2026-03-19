import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { LiquidFill } from '@/components/LiquidFill';
import { useBorrowerPoolsList } from '@/hooks/useBorrowerPools';
import { useCreatePool } from '@/hooks/useCreatePool';
import { useWallet } from '@/contexts/WalletContext';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage, isApiConfigured } from '@/lib/api';
import { MOCK_USDC_ADDRESS } from '@/lib/chain-constants';

function usdToMockUsdcAtomic(usd: string): string {
  const n = Number(String(usd).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Enter a valid borrow amount (USD)');
  }
  return BigInt(Math.round(n * 1_000_000)).toString();
}

function sameBorrower(a: string | null, b: string): boolean {
  if (!a) return false;
  if (/^0x[a-fA-F0-9]{40}$/i.test(a) && /^0x[a-fA-F0-9]{40}$/i.test(b)) {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

export default function BorrowerPools() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [borrowUsd, setBorrowUsd] = useState('');

  const { data: pools = [], isLoading, refetch } = useBorrowerPoolsList();
  const { address, role } = useWallet();
  const createPool = useCreatePool();

  const borrowerKey = address ?? '';
  const borrowerPools = pools.filter((p) => sameBorrower(borrowerKey, p.borrower));

  const handleCreate = async () => {
    if (!isApiConfigured()) {
      toast.error('Set VITE_API_URL and connect with MetaMask to create a pool.');
      return;
    }
    if (role !== 'borrower') {
      toast.error('Switch to Borrower role to create a pool.');
      return;
    }
    try {
      const poolSize = usdToMockUsdcAtomic(borrowUsd);
      await createPool.mutateAsync({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        poolSize,
      });
      toast.success('Pool creation queued — ROLE_MANAGER will submit to the factory.');
      setShowCreate(false);
      setName('');
      setSymbol('');
      setBorrowUsd('');
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
            <p className="text-sm text-muted-foreground mt-1">Manage your borrowing pools</p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gradient-primary rounded-xl glow-primary"
            disabled={!borrowerKey}
          >
            <Plus className="mr-2 h-4 w-4" /> Create Pool
          </Button>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading pools…</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {borrowerPools.map((pool) => {
            const fillPct = (pool.totalReceived / pool.totalRequested) * 100;
            return (
              <Link
                key={pool.id}
                to={`/borrower/pools/${pool.id}`}
                className="glass-card rounded-2xl p-6 transition-all hover:border-primary/30"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{pool.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pool.symbol} · {pool.acceptedTokens.join(', ')}
                    </p>
                  </div>
                  <StatusBadge status={pool.status} />
                </div>
                <div className="flex items-end justify-between">
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Received</p>
                      <p className="text-xl font-bold">${pool.totalReceived.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Requested</p>
                      <p className="text-sm text-muted-foreground">${pool.totalRequested.toLocaleString()}</p>
                    </div>
                  </div>
                  <LiquidFill percentage={fillPct} size="md" />
                </div>
              </Link>
            );
          })}
        </div>

        {!isLoading && borrowerPools.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No pools yet. Create one to deploy via the factory contract (backend ROLE_MANAGER signer submits the tx).
          </p>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="glass-card border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Your Pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pool Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Growth Fund Alpha"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g., GFA"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Value to Borrow (USD, mock USDC)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={borrowUsd}
                onChange={(e) => setBorrowUsd(e.target.value)}
                placeholder="500000"
                className="bg-secondary/50 border-border"
              />
              <p className="text-xs text-muted-foreground">
                Converted to USDC (6 decimals) for <code>poolSize</code> on-chain.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Accepted token</Label>
              <p className="text-sm text-muted-foreground rounded-xl border border-border bg-secondary/50 px-3 py-2">
                Mock USDC only —{' '}
                <span className="font-mono text-xs break-all">{MOCK_USDC_ADDRESS}</span>
              </p>
              {/*
              Multi-token selection (HBAR, USDT, …) — uncomment when supported again.
              */}
            </div>
            <Button
              type="button"
              className="w-full gradient-primary rounded-xl mt-2"
              disabled={createPool.isPending || !name.trim() || !symbol.trim() || !borrowUsd}
              onClick={() => void handleCreate()}
            >
              {createPool.isPending ? 'Submitting…' : 'Create Pool'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
