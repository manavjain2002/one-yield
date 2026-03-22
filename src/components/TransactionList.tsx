import { HashScanLink } from './HashScanLink';
import { StatusBadge } from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Layers, ShieldCheck, Rocket } from 'lucide-react';

export type Transaction = {
  id: string;
  type: string;
  amount: string;
  txHash: string;
  status: 'confirmed' | 'pending' | 'failed';
  createdAt: string;
  fromAddress?: string;
  toAddress?: string;
  tokenAddress?: string;
  blockNumber?: string;
};

interface TransactionListProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

export function TransactionList({ transactions, isLoading }: TransactionListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-secondary/30" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground bg-secondary/5 rounded-2xl border border-dashed border-border/50 mx-auto w-full italic">
        <Layers className="h-10 w-10 mb-4 opacity-20" />
        <p className="font-medium tracking-tight">No transactions found</p>
        <p className="text-xs opacity-50 mt-1">Activities will appear here once recorded on-chain</p>
      </div>
    );
  }

  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'deposit': return <ArrowDownLeft className="h-4 w-4 text-success" />;
      case 'withdraw':
      case 'redeem': return <ArrowUpRight className="h-4 w-4 text-orange-400" />;
      case 'repay':
      case 'repayment': return <RefreshCw className="h-4 w-4 text-primary" />;
      case 'deploy':
      case 'release': return <Rocket className="h-4 w-4 text-violet-400" />;
      case 'sweep':
      case 'transfer':
      case 'send_to_reserve': return <Layers className="h-4 w-4 text-blue-400" />;
      default: return <ShieldCheck className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const shortenAddr = (addr?: string) => {
    if (!addr) return '—';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  const parseDate = (raw: string) => {
    // Ensure the UTC marker is present for correct timezone handling
    const d = raw.endsWith('Z') || raw.includes('+') ? new Date(raw) : new Date(raw + 'Z');
    return d;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Type</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">From</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">To</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Time</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider hidden sm:table-cell">Tx Hash</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/10">
          {transactions.map((tx) => {
            const d = parseDate(tx.createdAt);
            return (
              <tr key={tx.id} className="hover:bg-secondary/5 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-secondary/50 border border-border/50">
                      {getIcon(tx.type)}
                    </div>
                    <span className="font-semibold capitalize group-hover:text-primary transition-colors">
                      {tx.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-bold text-foreground">
                  {tx.amount && tx.amount !== '0' ? `$${(Number(tx.amount) / 1e6).toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                  {shortenAddr(tx.fromAddress)}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                  {shortenAddr(tx.toAddress)}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {formatDistanceToNow(d, { addSuffix: true })}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <HashScanLink txHash={tx.txHash} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={tx.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
