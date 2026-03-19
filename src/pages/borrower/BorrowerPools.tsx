import { DashboardLayout } from '@/components/DashboardLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { LiquidFill } from '@/components/LiquidFill';
import { mockPools, TOKENS } from '@/data/mockData';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export default function BorrowerPools() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const borrowerPools = mockPools.filter(p => p.borrower === '0.0.4515312');

  const toggleToken = (t: string) => {
    setSelectedTokens(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Pools</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your borrowing pools</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gradient-primary rounded-xl glow-primary">
            <Plus className="mr-2 h-4 w-4" /> Create Pool
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {borrowerPools.map(pool => {
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
                    <p className="text-xs text-muted-foreground mt-0.5">{pool.symbol} · {pool.acceptedTokens.join(', ')}</p>
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
      </div>

      {/* Create Pool Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="glass-card border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Your Pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pool Name</Label>
              <Input placeholder="e.g., Growth Fund Alpha" className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input placeholder="e.g., GFA" className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Value to Borrow (USD)</Label>
              <Input type="number" placeholder="500,000" className="bg-secondary/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Accepted Tokens</Label>
              <div className="flex flex-wrap gap-2">
                {TOKENS.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleToken(t)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedTokens.includes(t)
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full gradient-primary rounded-xl mt-2">Create Pool</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
