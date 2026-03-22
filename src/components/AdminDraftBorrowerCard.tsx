import { AddressLink } from '@/components/AddressLink';
import { cn } from '@/lib/utils';
import type { AdminDraftBorrowerProfile } from '@/hooks/useAdminPoolActions';
import { User, Mail, Globe, Wallet, Shield, AtSign, Info } from 'lucide-react';

type Props = {
  borrowerIdentifier: string;
  borrower: AdminDraftBorrowerProfile | null;
  className?: string;
  compact?: boolean;
};

export function AdminDraftBorrowerCard({ borrowerIdentifier, borrower, className, compact }: Props) {
  const rows = borrower
    ? [
        { icon: User, label: 'Display name', value: borrower.displayName || '—' },
        { icon: Mail, label: 'Email', value: borrower.email || '—' },
        { icon: Globe, label: 'Country', value: borrower.country || '—' },
        { icon: AtSign, label: 'Username', value: borrower.username || '—' },
        {
          icon: Wallet,
          label: 'Wallet',
          value: borrower.walletAddress ? (
            <AddressLink address={borrower.walletAddress} />
          ) : (
            '—'
          ),
        },
        { icon: Shield, label: 'Role', value: borrower.role },
      ]
    : [];

  return (
    <div
      className={cn(
        'glass-card rounded-2xl border border-border/50 overflow-hidden shadow-sm',
        className,
      )}
    >
      <div className="px-5 py-4 bg-gradient-to-r from-primary/10 via-transparent to-transparent border-b border-border/40">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Borrower</h3>
        <p className="text-[11px] font-mono text-muted-foreground mt-1.5 break-all">{borrowerIdentifier}</p>
      </div>
      {!borrower ? (
        <div className="px-5 py-4 flex gap-3 items-start bg-secondary/5">
          <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Profile not linked in the database—showing identifier only. The submitter may use a wallet or username
            that does not match a user row yet.
          </p>
        </div>
      ) : (
        <div className={cn('px-5 py-4', compact ? 'space-y-2' : 'grid gap-3 sm:grid-cols-2')}>
          {rows.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className={cn(
                'flex gap-3 rounded-xl border border-border/30 bg-secondary/10 px-3 py-2.5',
                compact && 'py-2',
              )}
            >
              <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 text-primary shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <dt className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/80">{label}</dt>
                <dd className="text-sm font-medium mt-0.5 break-words">{value}</dd>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
