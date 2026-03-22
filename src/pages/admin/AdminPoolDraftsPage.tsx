import { DashboardLayout } from '@/components/DashboardLayout';
import { useAdminPoolDrafts } from '@/hooks/useAdminPoolDrafts';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function AdminPoolDraftsPage() {
  const { data: drafts = [], isLoading } = useAdminPoolDrafts();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pool drafts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submitted by borrowers. Open a draft to download documents and create the pool on-chain.
          </p>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Borrower</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : drafts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No pending drafts.
                  </td>
                </tr>
              ) : (
                drafts.map((d) => (
                  <tr key={d.id} className="hover:bg-secondary/5">
                    <td className="px-4 py-3 font-medium">
                      {d.name} <span className="text-muted-foreground">({d.symbol})</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-xs">
                      {d.borrowerIdentifier}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.hasDocument ? d.documentOriginalName ?? 'Attached' : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" asChild>
                        <Link to={`/admin/pool-drafts/${d.id}`}>Review</Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
