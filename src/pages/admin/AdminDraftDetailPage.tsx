import { DashboardLayout } from '@/components/DashboardLayout';
import { useParams, Link } from 'react-router-dom';
import { useAdminPoolDraft } from '@/hooks/useAdminPoolDrafts';
import { useAdminPoolActions } from '@/hooks/useAdminPoolActions';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function AdminDraftDetailPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const { data: draft, isLoading, isError } = useAdminPoolDraft(draftId);
  const { createPoolFromDraft } = useAdminPoolActions();

  const downloadFile = async () => {
    if (!draftId || !draft?.hasDocument) return;
    const res = await api.get(`/admin/pool-drafts/${draftId}/file`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = draft.documentOriginalName || 'pool-draft-file';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !draftId) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !draft) {
    return (
      <DashboardLayout>
        <p className="text-destructive">Draft not found.</p>
        <Button variant="link" asChild className="mt-4">
          <Link to="/admin/pool-drafts">Back to drafts</Link>
        </Button>
      </DashboardLayout>
    );
  }

  if (draft.indexed) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">This draft has already been indexed (pool created).</p>
        {draft.txHash && (
          <p className="text-xs font-mono mt-2 break-all">Tx: {draft.txHash}</p>
        )}
        <Button variant="link" asChild className="mt-4">
          <Link to="/admin">Admin home</Link>
        </Button>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
            <Link to="/admin/pool-drafts">← Drafts</Link>
          </Button>
          <h1 className="text-2xl font-bold">{draft.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{draft.symbol}</p>
        </div>

        <dl className="glass-card rounded-2xl border border-border/50 divide-y divide-border/10 text-sm">
          <div className="px-4 py-3 flex justify-between gap-4">
            <dt className="text-muted-foreground">Borrower</dt>
            <dd className="font-mono text-xs break-all">{draft.borrowerIdentifier}</dd>
          </div>
          <div className="px-4 py-3 flex justify-between gap-4">
            <dt className="text-muted-foreground">APY (bps)</dt>
            <dd>{draft.apyBasisPoints}</dd>
          </div>
          <div className="px-4 py-3 flex justify-between gap-4">
            <dt className="text-muted-foreground">Pool size (raw)</dt>
            <dd className="font-mono text-xs break-all">{draft.poolSize}</dd>
          </div>
          <div className="px-4 py-3 flex justify-between gap-4">
            <dt className="text-muted-foreground">Pool token</dt>
            <dd className="font-mono text-xs break-all">{draft.poolTokenAddress}</dd>
          </div>
          <div className="px-4 py-3 flex justify-between gap-4">
            <dt className="text-muted-foreground">Pool manager</dt>
            <dd className="font-mono text-xs break-all">{draft.poolManagerAddress}</dd>
          </div>
          <div className="px-4 py-3 flex justify-between gap-4">
            <dt className="text-muted-foreground">Oracle manager</dt>
            <dd className="font-mono text-xs break-all">{draft.oracleManagerAddress}</dd>
          </div>
          <div className="px-4 py-3 flex justify-between gap-4">
            <dt className="text-muted-foreground">Fee collector</dt>
            <dd className="font-mono text-xs break-all">{draft.feeCollectorAddress}</dd>
          </div>
        </dl>

        {draft.hasDocument && (
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => void downloadFile()}>
              Download {draft.documentOriginalName ?? 'file'}
            </Button>
          </div>
        )}

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium">Create pool on-chain</p>
          <p className="text-xs text-muted-foreground">
            Connect the admin wallet that is allowed to call the pool factory, then confirm the transaction.
            After mining, the app indexes the pool from the receipt.
          </p>
          <Button
            className="gradient-primary font-semibold"
            disabled={createPoolFromDraft.isPending}
            onClick={() => createPoolFromDraft.mutate(draft)}
          >
            {createPoolFromDraft.isPending ? 'Working…' : 'Approve & create pool'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
