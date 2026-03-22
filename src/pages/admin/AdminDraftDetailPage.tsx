import { DashboardLayout } from '@/components/DashboardLayout';
import { useParams, Link } from 'react-router-dom';
import { useAdminPoolDraft } from '@/hooks/useAdminPoolDrafts';
import { useAdminPoolActions } from '@/hooks/useAdminPoolActions';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { AdminDeployPoolButton } from '@/components/AdminDeployPoolButton';
import { Loader2, FileText } from 'lucide-react';
import { AddressLink } from '@/components/AddressLink';

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link to="/admin/pool-drafts">← All Drafts</Link>
            </Button>
            <h1 className="text-2xl font-bold">{draft.name} <span className="text-muted-foreground font-normal">({draft.symbol})</span></h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column: Details & Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/10">
              <div className="px-5 py-4 bg-secondary/10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pool Specifications</h3>
              </div>
              <div className="px-5 py-3 flex flex-col gap-1">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground">Borrower Identifier</dt>
                <dd className="font-mono text-xs break-all">{draft.borrowerIdentifier}</dd>
              </div>
              <div className="px-5 py-3 flex flex-col gap-1">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground">APY / Interest Rate</dt>
                <dd className="text-sm font-bold text-success">{draft.apyBasisPoints / 100}% ({draft.apyBasisPoints} bps)</dd>
              </div>
              <div className="px-5 py-3 flex flex-col gap-1">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground">Target Size</dt>
                <dd className="text-sm font-bold font-mono">${(Number(draft.poolSize) / 1e6).toLocaleString()}</dd>
              </div>
              <div className="px-5 py-3 flex flex-col gap-1">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground">Pool Token Address</dt>
                <AddressLink address={draft.poolTokenAddress} />
              </div>
              <div className="px-5 py-3 flex flex-col gap-1">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground">Pool Manager</dt>
                <AddressLink address={draft.poolManagerAddress} />
              </div>
              <div className="px-5 py-3 flex flex-col gap-1">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground">Fee Collector</dt>
                <AddressLink address={draft.feeCollectorAddress} />
              </div>
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-4 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-primary">On-Chain Deployment</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Review the specifications and supporting documents before creating. 
                  This action will deploy the contract via the Pool Factory.
                </p>
              </div>
              
              <AdminDeployPoolButton
                className="w-full gradient-primary font-bold h-12 rounded-xl shadow-lg glow-primary"
                draft={draft}
                isPending={createPoolFromDraft.isPending}
                onDeploy={(d) => createPoolFromDraft.mutate(d)}
                labelConnected="Create Pool on Chain"
              />
            </div>
          </div>

          {/* Right Column: document download only */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Compliance document</h3>
              {draft.hasDocument && (
                <Button variant="outline" size="sm" onClick={() => void downloadFile()} className="h-8 text-xs gap-2">
                  Download original
                </Button>
              )}
            </div>

            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden bg-secondary/5 min-h-[320px] flex flex-col items-center justify-center p-8 text-center">
              {draft.hasDocument ? (
                <div className="space-y-4 max-w-md">
                  <FileText className="h-14 w-14 mx-auto text-muted-foreground/35" />
                  <p className="text-sm text-muted-foreground">
                    In-app preview is disabled. Download opens the file using your current session token.
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No document provided for this draft</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
