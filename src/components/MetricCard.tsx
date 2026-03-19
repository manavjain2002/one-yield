import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  className?: string;
}

export function MetricCard({ title, value, change, changeType = 'neutral', icon, className }: MetricCardProps) {
  return (
    <div className={cn('glass-card rounded-2xl p-6 transition-all hover:border-primary/30', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {change && (
            <p className={cn('text-xs font-medium', {
              'text-success': changeType === 'positive',
              'text-destructive': changeType === 'negative',
              'text-muted-foreground': changeType === 'neutral',
            })}>
              {change}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}
