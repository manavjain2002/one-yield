import { DashboardLayout } from '@/components/DashboardLayout';
import { useParams, Link } from 'react-router-dom';
import { useAdminPools } from '@/hooks/useAdminPools';
import { useAdminPoolDraft } from '@/hooks/useAdminPoolDrafts';
import { useAdminPoolActions } from '@/hooks/useAdminPoolActions';
import { Button } from '@/components/ui/button';
import { AddressLink } from '@/components/AddressLink';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Loader2,
  FileText,
  Download,
  Pause,
  Play,
  XCircle,
  ChevronLeft,
  Wallet,
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePoolContractPaused } from '@/hooks/usePoolContractPaused';

export default function AdminPoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { data: pools = [], isLoading: poolsLoading } = useAdminPools();
  const pool = pools.find(p => p.id === id);
  
  const { data: draft, isLoading: draftLoading } = useAdminPoolDraft(pool?.draftId || '');
  const actions = useAdminPoolActions();

  const { data: isPaused, isLoading: pausedLoading } = usePoolContractPaused(pool?.contractAddress);

  const downloadFile = async () => {
    if (!draft) return;
    const res = await api.get(`/admin/pool-drafts/${draft.id}/file`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = draft.documentOriginalName || 'pool-draft-file';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (poolsLoading || (pool?.draftId && draftLoading)) {
    return (
      <DashboardLayout>
        <div className="h-[60vh] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
        </div>
      </DashboardLayout>
    );
  }

  if (!pool) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">Pool not found</div>
      </DashboardLayout>
    );
  }

  const isClosed = pool.status === 'closed';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="rounded-full">
              <Link to="/admin"><ChevronLeft className="h-5 w-5" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{pool.name}</h1>
                <StatusBadge status={isPaused ? 'paused' : pool.status} />
                {pausedLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-sm text-muted-foreground font-mono mt-1 flex items-center gap-2">
                {pool.contractAddress} <AddressLink address={pool.contractAddress} />
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 max-w-sm">
            {!isConnected && (
              <p className="text-[11px] text-muted-foreground text-right leading-snug">
                Connect a browser wallet to sign factory transactions (pause, unpause, close), same as when deploying from drafts.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!isConnected && (
                <Button type="button" variant="default" size="sm" className="gap-2" onClick={() => openConnectModal?.()}>
                  <Wallet className="h-3.5 w-3.5" /> Connect wallet
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !isConnected ||
                  actions.pauseTarget.isPending ||
                  isClosed ||
                  isPaused === true ||
                  pausedLoading
                }
                onClick={() => actions.pauseTarget.mutate(pool)}
                className="gap-2"
              >
                <Pause className="h-3.5 w-3.5" /> Pause
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  !isConnected ||
                  actions.unpauseTarget.isPending ||
                  isClosed ||
                  isPaused === false ||
                  pausedLoading
                }
                onClick={() => actions.unpauseTarget.mutate(pool)}
                className="gap-2"
              >
                <Play className="h-3.5 w-3.5" /> Unpause
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!isConnected || actions.closePoolFactory.isPending || isClosed}
                onClick={() => {
                  if (window.confirm('Close this pool via factory? This cannot be undone.')) {
                    actions.closePoolFactory.mutate(pool);
                  }
                }}
                className="gap-2"
              >
                <XCircle className="h-3.5 w-3.5" /> Close Pool
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 items-start max-w-4xl">
          <div className="space-y-6">
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/10">
              <div className="px-5 py-4 bg-secondary/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pool Specifications
              </div>
              <div className="px-5 py-3 flex flex-col gap-1">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground/70">On-chain pause</dt>
                <dd className="text-sm font-medium flex items-center gap-2">
                  {pausedLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Checking contract…</span>
                    </>
                  ) : isPaused ? (
                    'Yes — pool is paused'
                  ) : (
                    'No — active (not paused)'
                  )}
                </dd>
              </div>
              {[
                { label: 'Borrower', value: pool.borrowerAddress, isAddr: true },
                { label: 'APY', value: `${pool.apyBasisPoints / 100}% (${pool.apyBasisPoints} bps)` },
                { label: 'Pool Size', value: `$${(Number(pool.poolSize) / 1e6).toLocaleString()}`, isMono: true },
                { label: 'AUM', value: `$${(Number(pool.assetUnderManagement) / 1e6).toLocaleString()}`, isMono: true },
                { label: 'Token', value: pool.poolTokenAddress, isAddr: true },
                { label: 'Manager', value: pool.fundManagerAddress, isAddr: true },
                { label: 'LP Token', value: pool.lpTokenAddress, isAddr: true },
              ].map((item, idx) => (
                <div key={idx} className="px-5 py-3 flex flex-col gap-1">
                  <dt className="text-[10px] font-bold uppercase text-muted-foreground/70">{item.label}</dt>
                  <dd className={cn("text-sm font-medium", (item.isAddr || item.isMono) && "font-mono")}>
                    {item.isAddr ? (item.value ? <AddressLink address={item.value} /> : 'N/A') : item.value}
                  </dd>
                </div>
              ))}
            </div>

            {pool.draftId && (
              <div className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4" /> Original draft
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Deployed from draft <span className="font-mono text-[10px]">{pool.draftId}</span>.
                </p>
              </div>
            )}

            <div className="glass-card rounded-xl border border-border/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Loan tape</p>
                  {draft?.hasDocument ? (
                    <p className="text-xs text-muted-foreground truncate" title={draft.documentOriginalName ?? ''}>
                      {draft.documentOriginalName ?? 'Attached file'}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No file on record{pool.draftId ? ' for this draft.' : '.'}
                    </p>
                  )}
                </div>
              </div>
              {draft?.hasDocument ? (
                <Button type="button" size="sm" variant="secondary" className="shrink-0 gap-2" onClick={() => void downloadFile()}>
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
