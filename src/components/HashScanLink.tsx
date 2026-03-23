import { ExternalLink } from 'lucide-react';

export function HashScanLink({ txHash, label }: { txHash: string; label?: string }) {
  if (txHash.startsWith('pending-')) {
    return (
      <span className="text-xs font-mono text-muted-foreground" title={txHash}>
        {label ?? 'Queued…'}
      </span>
    );
  }
  return (
    <a
      href={`https://hashscan.io/testnet/transaction/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label || `${txHash.slice(0, 16)}...`}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
