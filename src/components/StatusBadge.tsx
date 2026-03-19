import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'active' | 'paused' | 'closed' | 'pending' | 'confirmed' | 'failed';
  className?: string;
}

const statusStyles = {
  active: 'bg-success/15 text-success border-success/30',
  confirmed: 'bg-success/15 text-success border-success/30',
  paused: 'bg-warning/15 text-warning border-warning/30',
  pending: 'bg-warning/15 text-warning border-warning/30',
  closed: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
      statusStyles[status],
      className
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', {
        'bg-success': status === 'active' || status === 'confirmed',
        'bg-warning': status === 'paused' || status === 'pending',
        'bg-muted-foreground': status === 'closed',
        'bg-destructive': status === 'failed',
      })} />
      {status}
    </span>
  );
}

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high';
  className?: string;
}

const riskStyles = {
  low: 'bg-success/15 text-success border-success/30',
  medium: 'bg-warning/15 text-warning border-warning/30',
  high: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
      riskStyles[level],
      className
    )}>
      {level} Risk
    </span>
  );
}
