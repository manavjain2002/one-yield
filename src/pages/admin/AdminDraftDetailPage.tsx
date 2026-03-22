import { DashboardLayout } from '@/components/DashboardLayout';
import { useParams, Link } from 'react-router-dom';
import { useAdminPoolDraft } from '@/hooks/useAdminPoolDrafts';
import { useAdminPoolActions } from '@/hooks/useAdminPoolActions';
import { Button } from '@/components/ui/button';
import { api, getErrorMessage } from '@/lib/api';
import { AdminDeployPoolButton } from '@/components/AdminDeployPoolButton';
import { Loader2, FileText, Download } from 'lucide-react';
import { AddressLink } from '@/components/AddressLink';
import { AdminDraftBorrowerCard } from '@/components/AdminDraftBorrowerCard';
import { useState } from 'react';
import { toast } from 'sonner';
import axios from 'axios';

export default function AdminDraftDetailPage() {
  const { draftId } = useParams<{ draftId: string }>();
  const { data: draft, isLoading, isError } = useAdminPoolDraft(draftId);
  const { createPoolFromDraft } = useAdminPoolActions();
  const [downloading, setDownloading] = useState(false);

  const downloadFile = async () => {
    if (!draftId || !draft?.hasDocument) return;
    setDownloading(true);
    try {
      const res = await api.get(`/admin/pool-drafts/${draftId}/file`, { responseType: 'blob' });
      if (res.status < 200 || res.status >= 300) {
        const text = await (res.data as Blob).text();
        let msg = 'Download failed.';
        try {
          const json = JSON.parse(text);
          msg = json.message || json.error || msg;
        } catch {
          msg = text || msg;
        }
        toast.error(msg);
        return;
      }
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = draft.documentOriginalName || 'pool-draft-file';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
        try {
          const text = await (e.response.data as Blob).text();
          const json = JSON.parse(text);
          toast.error(json.message || json.error || text);
        } catch {
          toast.error(getErrorMessage(e));
        }
      } else {
        toast.error(getErrorMessage(e));
      }
    } finally {
      setDownloading(false);
    }
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

        <div className="max-w-3xl space-y-6">
          <div className="space-y-6">
            <AdminDraftBorrowerCard
              borrowerIdentifier={draft.borrowerIdentifier}
              borrower={draft.borrower ?? null}
            />

            <div className="glass-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/10">
              <div className="px-5 py-4 bg-secondary/10">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pool Specifications</h3>
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

            <div className="glass-card rounded-xl border border-border/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Loan tape</p>
                  {draft.hasDocument ? (
                    <p className="text-xs text-muted-foreground truncate" title={draft.documentOriginalName ?? ''}>
                      {draft.documentOriginalName ?? 'Attached file'}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No file was submitted for this draft.</p>
                  )}
                </div>
              </div>
              {draft.hasDocument ? (
                <Button type="button" size="sm" className="shrink-0 gap-2" disabled={downloading} onClick={() => void downloadFile()}>
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloading ? 'Downloading…' : 'Download'}
                </Button>
              ) : null}
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-4 shadow-sm">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-primary">On-Chain Deployment</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Review the specifications and loan tape before creating.
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
        </div>
      </div>
    </DashboardLayout>
  );
}
