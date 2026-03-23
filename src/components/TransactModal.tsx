import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getLendingPoolRead, getERC20Read } from '@/lib/contracts';
import { useLenderActions } from '@/hooks/useLenderActions';
import { parseUnits, formatUnits } from 'ethers';
import type { Pool } from '@/data/mockData';
import { useTransaction } from '@/contexts/TransactionContext';

/** LP share token used for balance reads (matches pool display fallbacks elsewhere). */
function getLpTokenReadAddress(pool: Pool): string {
  const lp = pool.lpTokenAddress?.trim();
  return lp || pool.contractAddress;
}

interface TransactModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: Pool;
}

export function TransactModal({ isOpen, onClose, pool }: TransactModalProps) {
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const { startTransaction, endTransaction } = useTransaction();

  const {
    approve,
    deposit,
    redeem,
    allowance,
    isPaused,
    isLoadingLimits,
    address,
    maxRedeem,
  } = useLenderActions(pool);

  const lpTokenReadAddress = getLpTokenReadAddress(pool);

  /**
   * Withdraw "You pay" is LP shares. Cap = min(vault maxWithdraw in asset terms, assets implied by LP balance),
   * then convert to shares for Max + validation (ERC4626-aligned).
   */
  const withdrawMaxSharesQuery = useQuery({
    queryKey: ['transact-modal', 'withdraw-max-shares', pool.contractAddress, lpTokenReadAddress, address],
    queryFn: async () => {
      if (!pool.contractAddress || !lpTokenReadAddress || !address) {
        return { maxShares: 0n };
      }
      const vault = getLendingPoolRead(pool.contractAddress);
      const token = getERC20Read(lpTokenReadAddress);
      const [maxWithdrawAssets, lpBalance] = await Promise.all([
        vault.maxWithdraw(address).catch(() => 0n),
        token.balanceOf(address).catch(() => 0n),
      ]);
      const assetsFromLp = await vault.convertToAssets(lpBalance).catch(() => 0n);
      const maxAssets = maxWithdrawAssets < assetsFromLp ? maxWithdrawAssets : assetsFromLp;
      let maxShares: bigint;
      try {
        maxShares = await vault.previewWithdraw(maxAssets);
      } catch {
        maxShares = await vault.convertToShares(maxAssets).catch(() => 0n);
      }
      if (maxShares > lpBalance) maxShares = lpBalance;
      return { maxShares };
    },
    enabled: isOpen && mode === 'withdraw' && !!pool.contractAddress && !!lpTokenReadAddress && !!address,
    refetchInterval: 2000,
  });

  const maxSharesFromLiquidityAndBalance = withdrawMaxSharesQuery.data?.maxShares ?? 0n;
  /** Also respect vault maxRedeem once limits are loaded so redeem() matches the UI cap. */
  const maxWithdrawShares = (() => {
    const raw = maxSharesFromLiquidityAndBalance;
    if (isLoadingLimits) return raw;
    if (maxRedeem === 0n) return 0n;
    return raw < maxRedeem ? raw : maxRedeem;
  })();
  const maxWithdrawSharesStr = formatUnits(maxWithdrawShares, 6);

  const amountBN = amount && !isNaN(Number(amount)) ? parseUnits(amount, 6) : 0n;
  const needsApproval = mode === 'deposit' && amountBN > 0n && amountBN > allowance;

  const rateQuery = useQuery({
    queryKey: ['conversion-rate', pool.contractAddress, mode],
    queryFn: async () => {
      const contract = getLendingPoolRead(pool.contractAddress);
      const oneUnit = parseUnits('1', 6);
      if (mode === 'deposit') {
        const shares = await contract.convertToShares(oneUnit).catch(() => oneUnit);
        console.log('shares', shares);
        return { rate: Number(formatUnits(shares, 6)), fn: 'convertToShares' as const };
      } else {
        const assets = await contract.convertToAssets(oneUnit).catch(() => oneUnit);
        console.log('assets', assets);
        return { rate: Number(formatUnits(assets, 6)), fn: 'convertToAssets' as const };
      }
    },
    enabled: isOpen && !!pool.contractAddress,
    refetchInterval: 2000,
  });

  const outputQuery = useQuery({
    queryKey: ['conversion-output', pool.contractAddress, mode, amount],
    queryFn: async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return '0';
      const contract = getLendingPoolRead(pool.contractAddress);
      const inputBN = parseUnits(amount, 6);
      console.log('inputBN', inputBN, mode);
      if (mode === 'deposit') {
        const shares = await contract.convertToShares(inputBN).catch(() => inputBN);
        console.log('shares', shares);
        return formatUnits(shares, 6);
      } else {
        const assets = await contract.convertToAssets(inputBN).catch(() => inputBN);
        console.log('assets', assets);
        return formatUnits(assets, 6);
      }
    },
    enabled: isOpen && !!pool.contractAddress && !!amount && !isNaN(Number(amount)) && Number(amount) > 0,
    refetchInterval: 2000,
  });

  const outputAmount = outputQuery.data || '0';

  const upperToken = mode === 'deposit' ? (pool.poolTokenName || 'USDC') : (pool.lpTokenName || `${pool.symbol} LP`);
  const lowerToken = mode === 'deposit' ? (pool.lpTokenName || `${pool.symbol} LP`) : (pool.poolTokenName || 'USDC');

  const handleSwap = () => {
    setMode(mode === 'deposit' ? 'withdraw' : 'deposit');
    setAmount('');
  };

  const handleAction = async () => {
    if (!amount || Number(amount) <= 0) return;

    startTransaction(needsApproval ? 'Approving tokens...' : mode === 'deposit' ? 'Depositing...' : 'Withdrawing...');
    try {
      if (needsApproval) {
        await approve.mutateAsync(amount);
        return;
      }

      if (mode === 'deposit') {
        await deposit.mutateAsync(amount);
      } else {
        // Withdraw UI is LP shares → ERC4626 redeem, not withdraw(assets).
        await redeem.mutateAsync(amount);
      }
      setAmount('');
      onClose();
    } finally {
      endTransaction();
    }
  };

  let buttonText = mode === 'deposit' ? 'Deposit' : 'Withdraw';
  if (needsApproval) buttonText = `Approve ${upperToken}`;
  if (approve.isPending) buttonText = 'Approving...';
  if (deposit.isPending) buttonText = 'Depositing...';
  if (redeem.isPending) buttonText = 'Withdrawing...';

  const isPending = approve.isPending || deposit.isPending || redeem.isPending;

  const withdrawExceedsMax =
    mode === 'withdraw' &&
    withdrawMaxSharesQuery.isSuccess &&
    amountBN > maxWithdrawShares;

  useEffect(() => {
    if (!isOpen) { setAmount(''); setMode('deposit'); }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={() => !isPending && onClose()}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md rounded-2xl p-0 overflow-hidden">
        <div className="gradient-primary h-1 w-full" />
        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">
              Transact <span className="text-primary">{pool.name}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex rounded-xl bg-secondary/30 p-1">
            <button
              onClick={() => { setMode('deposit'); setAmount(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${mode === 'deposit' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Deposit
            </button>
            <button
              onClick={() => { setMode('withdraw'); setAmount(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${mode === 'withdraw' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Withdraw
            </button>
          </div>

          <div className="space-y-2">
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">You pay</span>
                {mode === 'withdraw' && (
                  <button
                    type="button"
                    onClick={() => setAmount(maxWithdrawSharesStr)}
                    disabled={withdrawMaxSharesQuery.isFetching && withdrawMaxSharesQuery.data === undefined}
                    className="text-[10px] text-primary font-bold hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {withdrawMaxSharesQuery.isFetching && withdrawMaxSharesQuery.data === undefined ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Max
                      </span>
                    ) : (
                      <>Max: {Number(maxWithdrawSharesStr).toLocaleString()}</>
                    )}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="flex-1 border-0 bg-transparent text-2xl font-bold p-0 h-auto focus-visible:ring-0"
                />
                <div className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-bold whitespace-nowrap">
                  {upperToken}
                </div>
              </div>
            </div>

            <div className="flex justify-center -my-1 relative z-10">
              <button
                onClick={handleSwap}
                className="rounded-xl border border-border bg-card p-2 shadow-md hover:bg-secondary transition-colors"
              >
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="rounded-xl border border-border bg-secondary/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">You receive</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-2xl font-bold text-muted-foreground">
                  {outputQuery.isFetching ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    Number(outputAmount).toLocaleString(undefined, { maximumFractionDigits: 6 })
                  )}
                </div>
                <div className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-bold whitespace-nowrap">
                  {lowerToken}
                </div>
              </div>
            </div>
          </div>

          {rateQuery.data && (
            <div className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/20 rounded-lg px-3 py-2">
              <span>Exchange Rate</span>
              <span className="font-mono font-bold">
                1 {upperToken} = {rateQuery.data.rate.toFixed(6)} {lowerToken}
              </span>
            </div>
          )}

          <Button
            className="w-full gradient-primary font-bold h-12 rounded-xl shadow-lg"
            disabled={
              isPending || !amount || Number(amount) <= 0 || isPaused || withdrawExceedsMax
            }
            onClick={handleAction}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {buttonText}
          </Button>

          {isPaused && (
            <p className="text-center text-xs text-destructive font-medium">This pool is currently paused.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
