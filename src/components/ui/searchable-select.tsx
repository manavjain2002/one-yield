import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Select...', className }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    o.value.toLowerCase().includes(search.toLowerCase()) ||
    (o.description?.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-background/50 px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length > 0 ? filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setIsOpen(false); setSearch(''); }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary',
                  o.value === value && 'bg-primary/10 text-primary'
                )}
              >
                <div>
                  <span className="font-medium">{o.label}</span>
                  {o.description && <span className="ml-2 text-xs text-muted-foreground">{o.description}</span>}
                </div>
                {o.value === value && <Check className="h-4 w-4" />}
              </button>
            )) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No results found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
