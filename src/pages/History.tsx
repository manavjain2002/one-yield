import { DashboardLayout } from '@/components/DashboardLayout';
import { TransactionList } from '@/components/TransactionList';
import { useTransactionHistory } from '@/hooks/useTransactionHistory';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, History as HistoryIcon } from 'lucide-react';

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useTransactionHistory(page, 10);

  const transactions = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Transaction History</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Complete audit log of your blockchain interactions
            </p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 min-h-[400px]">
          <TransactionList transactions={transactions} isLoading={isLoading} />
          
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="rounded-xl border-border"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="rounded-xl border-border"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
