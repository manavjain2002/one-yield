import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAdminPools } from '@/hooks/useAdminPools';
import { useAdminPoolActions } from '@/hooks/useAdminPoolActions';
import { Link } from 'react-router-dom';
import { useAdminPoolDrafts } from '@/hooks/useAdminPoolDrafts';
import { StatusBadge } from '@/components/StatusBadge';
import { AddressLink } from '@/components/AddressLink';

export default function AdminDashboard() {
  const { data: pools = [], isLoading: poolsLoading } = useAdminPools();
  const { data: drafts = [], isLoading: draftsLoading } = useAdminPoolDrafts();
  const actions = useAdminPoolActions();

  const pendingDrafts = drafts.length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review borrower pool drafts, create pools from the factory wallet, and control factory pause / close.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/admin/pool-drafts"
            className="glass-card rounded-2xl border border-border/50 p-6 hover:border-primary/40 transition-colors"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending drafts</p>
            <p className="text-3xl font-bold mt-2">{draftsLoading ? '—' : pendingDrafts}</p>
            <p className="text-sm text-primary mt-2 font-medium">Open draft queue →</p>
          </Link>
          <div className="glass-card rounded-2xl border border-border/50 p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Indexed pools</p>
            <p className="text-3xl font-bold mt-2">{poolsLoading ? '—' : pools.length}</p>
            <p className="text-sm text-muted-foreground mt-2">Listed below with factory controls.</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-base font-semibold">Pools</h2>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/pool-drafts">Review drafts</Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Contract</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Factory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {poolsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : pools.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No pools yet.
                    </td>
                  </tr>
                ) : (
                  pools.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary/5">
                      <td className="px-4 py-3 font-medium">
                        {p.name}{' '}
                        <span className="text-muted-foreground font-normal">({p.symbol})</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <AddressLink address={p.contractAddress} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-8"
                          disabled={actions.pauseTarget.isPending || p.status === 'closed'}
                          onClick={() => actions.pauseTarget.mutate(p)}
                        >
                          Pause
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-8"
                          disabled={actions.unpauseTarget.isPending || p.status === 'closed'}
                          onClick={() => actions.unpauseTarget.mutate(p)}
                        >
                          Unpause
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-[10px] h-8"
                          disabled={actions.closePoolFactory.isPending || p.status === 'closed'}
                          onClick={() => {
                            if (window.confirm('Close this pool via factory? This cannot be undone.')) {
                              actions.closePoolFactory.mutate(p);
                            }
                          }}
                        >
                          Close
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
