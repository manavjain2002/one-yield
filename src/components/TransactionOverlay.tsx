import { useTransaction } from '@/contexts/TransactionContext';
import { Loader2 } from 'lucide-react';

export function TransactionOverlay() {
  const { isTransacting, txMessage } = useTransaction();

  if (!isTransacting) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-foreground">{txMessage}</p>
        <p className="text-xs text-muted-foreground">Please do not close or navigate away.</p>
      </div>
    </div>
  );
}
