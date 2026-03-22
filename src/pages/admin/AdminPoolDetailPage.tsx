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
  ExternalLink
} from 'lucide-react';
import { api, loadStoredToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getLendingPoolRead } from '@/lib/contracts';

export default function AdminPoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: pools = [], isLoading: poolsLoading } = useAdminPools();
  const pool = pools.find(p => p.id === id);
  
  const { data: draft, isLoading: draftLoading } = useAdminPoolDraft(pool?.draftId || '');
  const actions = useAdminPoolActions();

  const { data: isPaused, isLoading: pausedLoading } = useQuery({
    queryKey: ['pool-paused', pool?.contractAddress],
    queryFn: async () => {
      if (!pool?.contractAddress) return false;
      return await getLendingPoolRead(pool.contractAddress).paused();
    },
    enabled: !!pool?.contractAddress,
  });

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

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={actions.pauseTarget.isPending || isClosed || isPaused === true || pausedLoading}
              onClick={() => actions.pauseTarget.mutate(pool)}
              className="gap-2"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={actions.unpauseTarget.isPending || isClosed || isPaused === false || pausedLoading}
              onClick={() => actions.unpauseTarget.mutate(pool)}
              className="gap-2"
            >
              <Play className="h-3.5 w-3.5" /> Unpause
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actions.closePoolFactory.isPending || isClosed}
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Details Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/10">
              <div className="px-5 py-4 bg-secondary/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pool Specifications
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
                  <FileText className="h-4 w-4" /> Original Draft Information
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This pool was deployed from draft <span className="font-mono text-[10px]">{pool.draftId}</span>. 
                  Below is the compliance document submitted during the proposal.
                </p>
              </div>
            )}
          </div>

          {/* Document Column */}
          <div className="lg:col-span-7 flex flex-col gap-3">
             <div className="flex items-center justify-between px-1">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Compliance Document</h4>
              {draft?.hasDocument && (
                <button 
                  onClick={() => void downloadFile()}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              )}
            </div>
            <div className="aspect-[3/4] glass-card rounded-2xl border border-border/50 bg-secondary/5 overflow-hidden relative shadow-inner">
              {draft?.hasDocument ? (
                <iframe
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/pool-drafts/${draft.id}/file?token=${loadStoredToken() || ''}#toolbar=0`}
                  className="w-full h-full absolute inset-0 border-none bg-white/50"
                  title="Document"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 p-12 text-center">
                  <FileText className="h-16 w-16 mb-4 opacity-10" />
                  <p className="text-sm font-medium">No document available for this pool</p>
                  <p className="text-xs mt-1">Check original draft specifications if applicable.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
