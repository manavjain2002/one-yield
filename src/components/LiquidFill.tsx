import { cn } from '@/lib/utils';

interface LiquidFillProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
}

export function LiquidFill({ percentage, size = 'md', className, showLabel = true }: LiquidFillProps) {
  const clampedPct = Math.min(100, Math.max(0, percentage));
  const heights = { sm: 'h-16 w-12', md: 'h-24 w-16', lg: 'h-32 w-24' };

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className={cn('relative overflow-hidden rounded-xl border border-primary/20 bg-secondary/50', heights[size])}>
        {/* Liquid fill */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out"
          style={{ height: `${clampedPct}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-accent/60" />
          {/* Wave effect */}
          <svg className="absolute -top-2 left-0 w-[200%] liquid-wave" viewBox="0 0 400 20" preserveAspectRatio="none">
            <path d="M0,10 C50,0 100,20 200,10 C300,0 350,20 400,10 L400,20 L0,20 Z" fill="hsl(230 80% 60% / 0.6)" />
          </svg>
        </div>
        {/* Glass reflection */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-primary">{clampedPct.toFixed(0)}%</span>
      )}
    </div>
  );
}
