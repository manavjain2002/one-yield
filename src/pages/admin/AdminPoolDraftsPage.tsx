import { DashboardLayout } from '@/components/DashboardLayout';
import { useAdminPoolDrafts, useAdminPoolDraft } from '@/hooks/useAdminPoolDrafts';
import { useAdminPoolActions } from '@/hooks/useAdminPoolActions';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AddressLink } from '@/components/AddressLink';
import { Loader2, FileText, Download, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, loadStoredToken } from '@/lib/api';

function DraftDetailView({ id }: { id: string }) {
  const { data: draft, isLoading } = useAdminPoolDraft(id);
  const actions = useAdminPoolActions();

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

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (!draft) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Details Sub-column */}
      <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar">
        <div className="glass-card rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/10">
          <div className="px-4 py-3 bg-secondary/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Specifications
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full">DRAFT</span>
          </div>
          {[
            { label: 'Borrower', value: draft.borrowerIdentifier, isAddr: /^0x[a-fA-F0-9]{40}$/.test(draft.borrowerIdentifier || '') },
            { label: 'APY', value: `${draft.apyBasisPoints / 100}% (${draft.apyBasisPoints} bps)` },
            { label: 'Target Size', value: `$${(Number(draft.poolSize) / 1e6).toLocaleString()}`, isMono: true },
            { label: 'Token', value: draft.poolTokenAddress, isAddr: true },
            { label: 'Manager', value: draft.poolManagerAddress, isAddr: true },
            { label: 'Oracle', value: draft.oracleManagerAddress, isAddr: true },
            { label: 'Collector', value: draft.feeCollectorAddress, isAddr: true },
          ].map((item, idx) => (
            <div key={idx} className="px-4 py-2.5 flex flex-col gap-0.5">
              <dt className="text-[9px] font-bold uppercase text-muted-foreground/70">{item.label}</dt>
              <dd className={cn("text-xs font-medium", (item.isAddr || item.isMono) && "font-mono")}>
                {item.isAddr ? <AddressLink address={item.value} /> : item.value}
              </dd>
            </div>
          ))}

        </div>

        <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4 shadow-sm">
          <div>
            <h4 className="text-sm font-bold text-primary flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Deploy to Factory
            </h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
              Confirm that all details match signed legal agreements before deployment. 
              This will create a new on-chain lending pool.
            </p>
          </div>
          <Button
            className="w-full gradient-primary font-bold h-11 rounded-xl shadow-md glow-primary"
            disabled={actions.createPoolFromDraft.isPending || draft.indexed}
            onClick={() => actions.createPoolFromDraft.mutate(draft)}
          >
            {actions.createPoolFromDraft.isPending ? "Deploying..." : draft.indexed ? "Already Deployed" : "Create Pool On-Chain"}
          </Button>
        </div>
      </div>

      {/* Preview Sub-column */}
      <div className="flex flex-col gap-3 h-full overflow-hidden">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Document Preview</h4>
          {draft.hasDocument && (
            <button 
              onClick={() => void downloadFile()}
              className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Download className="h-3 w-3" /> Download
            </button>
          )}
        </div>
        <div className="flex-1 glass-card rounded-2xl border border-border/50 bg-secondary/5 overflow-hidden relative min-h-[400px]">
          {draft.hasDocument ? (
            <iframe
              src={`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/admin/pool-drafts/${draft.id}/file?token=${loadStoredToken() || ''}#toolbar=0`}
              className="w-full h-full absolute inset-0 border-none bg-white/50"
              title="Document"
            />

          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 p-8 text-center bg-secondary/10">
              <FileText className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-xs">No compliance document attached</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPoolDraftsPage() {
  const { data: drafts = [], isLoading } = useAdminPoolDrafts();
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-6 h-[calc(100vh-10rem)] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pool Drafts Review</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and deploy borrower-submitted pool specifications.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden">
          {/* Left Column: List */}
          <div className="lg:col-span-4 flex flex-col gap-2 overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : drafts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic glass-card rounded-2xl border-dashed border-border/40">No pending drafts</div>
            ) : (
              drafts.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDraftId(d.id)}
                  className={cn(
                    "glass-card text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden",
                    selectedDraftId === d.id 
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-lg" 
                      : "border-border/40 hover:border-primary/40 hover:bg-secondary/20"
                  )}
                >
                  {selectedDraftId === d.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                  )}
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-sm truncate pr-2">{d.name}</h3>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0 uppercase">{d.symbol}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate mb-3">{d.borrowerIdentifier}</p>
                  <div className="flex items-center justify-between border-t border-border/10 pt-2">
                    <span className="text-xs font-bold text-success">{d.apyBasisPoints / 100}% APR</span>
                    <div className="flex items-center gap-2">
                      {d.hasDocument && <FileText className="h-3 w-3 text-primary opacity-60" />}
                      <ArrowRight className={cn("h-3 w-3 transition-transform duration-200", selectedDraftId === d.id ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100")} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Right Column: Detail View */}
          <div className="lg:col-span-8 flex flex-col overflow-hidden glass-card rounded-2xl border border-border/50">
            {selectedDraftId ? (
              <div className="p-6 h-full overflow-hidden">
                <DraftDetailView id={selectedDraftId} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-secondary/5 text-muted-foreground/60 p-12 text-center">
                <div className="max-w-xs space-y-4">
                  <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto ring-8 ring-secondary/40">
                    <FileText className="h-8 w-8 opacity-40" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground/80">Select a Draft</h3>
                    <p className="text-xs leading-relaxed mt-1">Review pool specifications and compliance documents before on-chain deployment.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
