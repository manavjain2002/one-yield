import { DashboardLayout } from '@/components/DashboardLayout';
import { TransactionList } from '@/components/TransactionList';
import {
  useTransactionHistory,
  type ManagerTxCategory,
} from '@/hooks/useTransactionHistory';
import { useWallet } from '@/contexts/WalletContext';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, ChevronRight, History as HistoryIcon } from 'lucide-react';

const MANAGER_HISTORY_TABS: { value: ManagerTxCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'deployments', label: 'Deployments' },
  { value: 'deposits', label: 'Deposits' },
  { value: 'withdrawals', label: 'Withdrawals' },
  { value: 'repayments', label: 'Repayments' },
  { value: 'operations', label: 'Operations' },
];

export default function HistoryPage() {
  const { role } = useWallet();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<ManagerTxCategory>('all');
  const managerCategory = role === 'manager' ? category : undefined;

  useEffect(() => {
    setPage(1);
  }, [category, role]);

  const { data, isLoading } = useTransactionHistory(page, 10, managerCategory);

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

        <div className="glass-card rounded-2xl p-6 min-h-[400px] space-y-4">
          {role === 'manager' && (
            <Tabs
              value={category}
              onValueChange={(v) => setCategory(v as ManagerTxCategory)}
              className="space-y-4"
            >
              <TabsList className="bg-secondary/50 rounded-xl flex flex-wrap h-auto gap-1 p-1 w-full justify-start">
                {MANAGER_HISTORY_TABS.map(({ value, label }) => (
                  <TabsTrigger key={value} value={value} className="rounded-lg text-xs sm:text-sm">
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
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
