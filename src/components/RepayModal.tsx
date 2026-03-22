import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useBorrowerWeb3Actions } from '@/hooks/useBorrowerWeb3Actions';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronLeft, Wallet } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { parseUnits } from 'ethers';
import { useQuery } from '@tanstack/react-query';
import { getAssetManagerRead } from '@/lib/contracts';

interface RepayModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolId: string;
  poolName: string;
  symbol: string;
  poolTokenAddress: string;
  fundManagerAddress: string;
  borrowerPools?: { v1PoolId: string; dedicatedWalletAddress: string }[] | null;
}

export function RepayModal({
  isOpen, onClose, poolId, poolName, symbol, poolTokenAddress, fundManagerAddress, borrowerPools = []
}: RepayModalProps) {
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('0');

  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();

  // Fetch on-chain v1Pools when borrowerPools from DB is empty (e.g. child pools added only on-chain)
  const { data: onChainPools = [] } = useQuery({
    queryKey: ['repay-v1-pools', fundManagerAddress],
    queryFn: async () => {
      if (!fundManagerAddress) return [];
      const fm = getAssetManagerRead(fundManagerAddress);
      const count = await fm.totalV1Pools();
      const pools: { v1PoolId: string; wallet: string }[] = [];
      for (let i = 0; i < Number(count); i++) {
        try {
          const result = await fm.v1Pools(i);
          const v1Id = result.v1PoolId ?? result[0];
          const wallet = result.wallet ?? result[2] ?? (await fm.dedicatedWallet(v1Id));
          pools.push({ v1PoolId: String(v1Id), wallet: String(wallet) });
        } catch { /* skip */ }
      }
      return pools;
    },
    enabled: isOpen && !!fundManagerAddress && (!borrowerPools || borrowerPools.length === 0),
    refetchInterval: 10000,
  });

  // Use borrowerPools from DB if available, else fall back to on-chain data
  const authorizedPools = (borrowerPools?.length ? borrowerPools : onChainPools.map(p => ({
    v1PoolId: p.v1PoolId,
    dedicatedWalletAddress: p.wallet,
  }))) as { v1PoolId: string; dedicatedWalletAddress: string }[];

  const matchedBorrowerPool = authorizedPools?.find(
    (bp) => bp.dedicatedWalletAddress?.toLowerCase() === address?.toLowerCase()
  );
  const isAuthorized = !!matchedBorrowerPool;
  const v1PoolId = matchedBorrowerPool ? matchedBorrowerPool.v1PoolId : '';

  const { allowanceQuery, approve, repay, tokenDecimals } = useBorrowerWeb3Actions({
    poolTokenAddress,
    fundManagerAddress,
    poolId
  });

  const totalHuman = (parseFloat(amount) || 0) + (parseFloat(fee) || 0);

  // Match on-chain units exactly (avoid parseFloat → toString() float noise breaking parseUnits)
  let totalWei = 0n;
  try {
    totalWei = parseUnits(amount || '0', tokenDecimals) + parseUnits(fee || '0', tokenDecimals);
  } catch {
    // ignore parse errors while typing
  }

  const allowanceWei = allowanceQuery.data ?? 0n;
  const needsApproval = totalWei > 0n && allowanceWei < totalWei;
  const isPending = approve.isPending || repay.isPending;

  const handleNext = () => {
    if (isConnected && !isAuthorized) {
      toast.error('The connected wallet is not configured as a borrower for this pool.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setStep('confirm');
  };

  const handleActionClick = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    if (needsApproval) {
      try {
        await approve.mutateAsync({ amount, fee });
      } catch {
        // Error handled in hook
      }
      return;
    }

    // Ready to repay
    try {
      await repay.mutateAsync({
        v1PoolId,
        amount,
        fee
      });
      onClose();
      reset();
    } catch {
      // Error handled in hook
    }
  };

  const reset = () => {
    setStep('input');
    setAmount('');
    setFee('0');
  };

  const handleClose = () => {
    if (isPending) return;
    onClose();
    reset();
  };

  let buttonText = 'Confirm Repayment';
  if (step === 'input') {
    buttonText = 'Next Step';
  } else if (!isConnected) {
    buttonText = 'Connect Wallet to Repay';
  } else if (!isAuthorized) {
    buttonText = 'Wallet Not Authorized';
  } else if (approve.isPending) {
    buttonText = 'Approving...';
  } else if (needsApproval) {
    buttonText = `Approve ${symbol}`;
  } else if (repay.isPending) {
    buttonText = 'Processing...';
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass-card border-border/50 p-0 overflow-hidden">
        <div className="gradient-primary h-1.5 w-full" />

        <div className="p-6 space-y-6">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Wallet className="w-5 h-5" />
              </div>
              {step === 'input' ? 'Repay Loan' : 'Confirm Repayment'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{poolName}</p>
          </DialogHeader>

          {step === 'input' ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount to Repay</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isConnected && !isAuthorized}
                    className="h-12 pr-16 rounded-xl bg-secondary/30 focus:bg-secondary/50 transition-all border-border/50 text-lg font-bold font-mono disabled:opacity-50"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-primary px-2 py-1 rounded bg-primary/10">
                    {symbol}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="fee" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fee (Optional)</Label>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Usually 0</span>
                </div>
                <div className="relative">
                  <Input
                    id="fee"
                    type="number"
                    placeholder="0.00"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    disabled={isConnected && !isAuthorized}
                    className="h-10 pr-16 rounded-xl bg-secondary/20 focus:bg-secondary/40 transition-all border-border/50 font-mono disabled:opacity-50"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                    {symbol}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 items-start">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Repaying reduces your outstanding debt and stops interest accrual on the repaid principal.
                </p>
              </div>

              {isConnected && !isAuthorized && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive font-medium leading-relaxed">
                    The currently connected wallet is not configured as an authorized repayment address for this pool.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="space-y-4 rounded-2xl bg-secondary/30 p-5 border border-border/50">
                <div className="flex justify-between items-center pb-3 border-b border-border/20">
                  <span className="text-sm text-muted-foreground">Repayment Amount</span>
                  <span className="font-bold font-mono">{parseFloat(amount).toLocaleString()} {symbol}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-border/20">
                  <span className="text-sm text-muted-foreground">Transaction Fee</span>
                  <span className="font-bold font-mono">{parseFloat(fee || '0').toLocaleString()} {symbol}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-bold text-foreground">Total to Send</span>
                  <span className="text-xl font-black text-primary font-mono">{totalHuman.toLocaleString()} {symbol}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700/80 leading-relaxed font-medium">
                  This transaction will execute directly from your Web3 wallet. Ensure you have the required balance and {symbol} allowance.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            {step === 'confirm' && (
              <Button
                variant="ghost"
                onClick={() => setStep('input')}
                disabled={isPending}
                className="rounded-xl flex-1 h-12 font-bold text-muted-foreground"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}

            <Button
              onClick={step === 'input' ? handleNext : handleActionClick}
              disabled={isPending || (isConnected && !isAuthorized)}
              className={`rounded-xl h-12 font-bold shadow-lg transition-all active:scale-95 ${
                step === 'confirm' ? 'flex-[2]' : 'w-full'
              } ${
                buttonText === 'Connect Wallet to Repay'
                  ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-primary/30'
                  : 'gradient-primary glow-primary'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {step === 'input' ? (
                <>Next Step <ArrowRight className="w-4 h-4 ml-2" /></>
              ) : (
                buttonText
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

