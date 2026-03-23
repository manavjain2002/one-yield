import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, isApiConfigured } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HashScanLink } from '@/components/HashScanLink';
import { Copy, Droplets, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { formatUnits } from 'ethers';
import { getERC20Read } from '@/lib/contracts';
import { FAUCET_WALLET_ADDRESS } from '@/lib/chain-constants';
import logo from '@/assets/oneyield-logo.png';

export type FaucetInfo = {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  claimEnabled: boolean;
  maxPerTxHuman: string;
};

const EVM_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function parseApiError(err: unknown): string {
  if (err instanceof AxiosError) {
    const d = err.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(d?.message)) return d.message.join(', ');
    if (typeof d?.message === 'string') return d.message;
    return err.message || 'Request failed';
  }
  return 'Something went wrong';
}

export default function FaucetPage() {
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const infoQuery = useQuery({
    queryKey: ['faucet', 'info'],
    queryFn: async () => {
      const { data } = await api.get<FaucetInfo>('/faucet/info');
      return data;
    },
    enabled: isApiConfigured(),
    retry: 1,
  });

  const tokenAddress = infoQuery.data?.tokenAddress;
  const tokenDecimals = infoQuery.data?.decimals ?? 18;

  const faucetBalanceQuery = useQuery({
    queryKey: ['faucet', 'faucetWalletBalance', tokenAddress, FAUCET_WALLET_ADDRESS] as const,
    queryFn: async () => {
      const c = getERC20Read(tokenAddress!);
      const raw = await c.balanceOf(FAUCET_WALLET_ADDRESS);
      return BigInt(raw.toString());
    },
    enabled: Boolean(isApiConfigured() && tokenAddress && EVM_ADDR_RE.test(tokenAddress)),
    retry: 1,
    refetchInterval: 60_000,
  });

  const claimMutation = useMutation({
    mutationFn: async (body: { recipient: string; amount: string }) => {
      const { data } = await api.post<{ txHash: string }>('/faucet/claim', body);
      return data;
    },
    onSuccess: (data) => {
      setLastTxHash(data.txHash);
      toast.success('Tokens sent');
      void queryClient.invalidateQueries({ queryKey: ['faucet', 'faucetWalletBalance'] });
    },
    onError: (err) => {
      toast.error(parseApiError(err));
    },
  });

  const copyAddress = () => {
    const addr = infoQuery.data?.tokenAddress;
    if (!addr) return;
    void navigator.clipboard.writeText(addr);
    toast.success('Contract address copied');
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLastTxHash(null);
    const r = recipient.trim();
    const a = amount.trim();
    if (!EVM_ADDR_RE.test(r)) {
      toast.error('Enter a valid 0x-prefixed wallet address');
      return;
    }
    if (!/^\d+(\.\d+)?$/.test(a) || Number(a) <= 0) {
      toast.error('Enter a positive decimal amount');
      return;
    }
    claimMutation.mutate({ recipient: r, amount: a });
  };

  if (!isApiConfigured()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        <p className="text-muted-foreground text-center">
          API is not configured. Set <code className="text-xs">VITE_API_URL</code> (or runtime config) to use the faucet.
        </p>
        <Link to="/" className="mt-6 text-sm text-primary hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-secondary/20">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="OneYield" className="h-10 w-auto opacity-90" />
          <div className="flex items-center gap-2 text-primary">
            <Droplets className="h-6 w-6" />
            <h1 className="text-2xl font-bold tracking-tight">Testnet faucet</h1>
          </div>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Request mock USDC for Hedera EVM testnet. This page is not linked from the app; use the URL directly.
          </p>
        </div>

        <div className="glass-card rounded-2xl border border-border/50 p-6 shadow-xl space-y-6">
          {infoQuery.isLoading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-secondary/60 rounded w-3/4" />
              <div className="h-4 bg-secondary/60 rounded w-1/2" />
              <div className="h-4 bg-secondary/60 rounded w-2/3" />
            </div>
          )}

          {infoQuery.isError && (
            <p className="text-sm text-destructive">
              Could not load token info. {parseApiError(infoQuery.error)}
            </p>
          )}

          {infoQuery.data && (
            <>
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Token
                </h2>
                <dl className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium text-right">{infoQuery.data.name}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Symbol</dt>
                    <dd className="font-medium text-right">{infoQuery.data.symbol}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Decimals</dt>
                    <dd className="font-mono text-right">{infoQuery.data.decimals}</dd>
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <dt className="text-muted-foreground">Contract</dt>
                    <dd className="flex items-center gap-2 flex-wrap">
                      <code className="text-xs font-mono break-all bg-secondary/50 px-2 py-1 rounded-md">
                        {infoQuery.data.tokenAddress}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={copyAddress}
                        aria-label="Copy contract address"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-border/40 bg-secondary/20 px-3 py-3 space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Faucet wallet balance
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground font-mono text-xs break-all">{FAUCET_WALLET_ADDRESS}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      void navigator.clipboard.writeText(FAUCET_WALLET_ADDRESS);
                      toast.success('Faucet wallet address copied');
                    }}
                    aria-label="Copy faucet wallet address"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {faucetBalanceQuery.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" aria-hidden />
                  ) : null}
                </div>
                {faucetBalanceQuery.isError && (
                  <p className="text-xs text-destructive">
                    Could not load balance. Check RPC and contract address.{' '}
                    {faucetBalanceQuery.error instanceof Error ? faucetBalanceQuery.error.message : ''}
                  </p>
                )}
                {faucetBalanceQuery.data !== undefined && !faucetBalanceQuery.isError && (
                  <p className="text-lg font-semibold tabular-nums">
                    {formatUnits(faucetBalanceQuery.data, tokenDecimals)}{' '}
                    <span className="text-sm font-medium text-muted-foreground">{infoQuery.data.symbol}</span>
                  </p>
                )}
              </div>

              {!infoQuery.data.claimEnabled && (
                <p className="text-sm text-amber-600 dark:text-amber-500 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  Claims are disabled: the server has no <code className="text-xs">FAUCET_PRIVATE_KEY</code> configured.
                  Token details above are still valid for manual transfers.
                </p>
              )}

              <form onSubmit={onSubmit} className="space-y-4 pt-2 border-t border-border/40">
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient wallet</Label>
                  <Input
                    id="recipient"
                    placeholder="0x…"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="font-mono text-sm rounded-xl"
                    disabled={!infoQuery.data.claimEnabled || claimMutation.isPending}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ({infoQuery.data.symbol})</Label>
                  <Input
                    id="amount"
                    placeholder={`max ${infoQuery.data.maxPerTxHuman} per request`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="rounded-xl"
                    disabled={!infoQuery.data.claimEnabled || claimMutation.isPending}
                    inputMode="decimal"
                  />
                  <p className="text-xs text-muted-foreground">
                    Human-readable amount (token uses {infoQuery.data.decimals} decimals). Max {infoQuery.data.maxPerTxHuman}{' '}
                    {infoQuery.data.symbol} per claim.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-xl gradient-primary font-semibold"
                  disabled={!infoQuery.data.claimEnabled || claimMutation.isPending}
                >
                  {claimMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Request tokens'
                  )}
                </Button>
              </form>

              {lastTxHash && (
                <div className="rounded-xl border border-success/30 bg-success/5 px-3 py-3 text-sm space-y-1">
                  <p className="font-medium text-success">Transfer confirmed</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <HashScanLink txHash={lastTxHash} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
