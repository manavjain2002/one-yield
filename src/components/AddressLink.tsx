import { ExternalLink } from 'lucide-react';

interface AddressLinkProps {
  address: string;
  label?: string;
  type?: 'address' | 'transaction';
}

export function AddressLink({ address, label, type = 'address' }: AddressLinkProps) {
  if (!address || address.length < 10) return <span className="text-xs text-muted-foreground">—</span>;
  const short = `${address.slice(0, 10)}...${address.slice(-6)}`;
  const path = type === 'transaction' ? 'transaction' : 'address';
  return (
    <a
      href={`https://hashscan.io/testnet/${path}/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-primary transition-colors"
    >
      {short}
      <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
    </a>
  );
}
