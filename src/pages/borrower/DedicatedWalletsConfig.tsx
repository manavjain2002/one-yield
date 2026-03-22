import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useBorrowerWallets, useSetBorrowerWallet, useUpdateBorrowerWallet, useDeleteBorrowerWallet } from '@/hooks/useBorrowerWallets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Wallet, CheckCircle2, Pencil, Trash2 } from 'lucide-react';

export function DedicatedWalletsConfig() {
  const { data: tokens = [] } = useQuery({
    queryKey: ['constants', 'tokens'],
    queryFn: async () => {
      const { data } = await api.get<{ symbol: string; name: string; address: string }[]>('/pools/constants/tokens');
      return data;
    },
  });

  const { data: wallets = [], isLoading: isLoadingWallets } = useBorrowerWallets();
  const setWallet = useSetBorrowerWallet();
  const updateWallet = useUpdateBorrowerWallet();
  const deleteWallet = useDeleteBorrowerWallet();
  const [editingId, setEditingId] = useState<string | null>(null);

  const [selectedToken, setSelectedToken] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      setSelectedToken(tokens[0].address);
    }
  }, [tokens, selectedToken]);

  const handleSave = () => {
    if (!selectedToken || !walletAddress) return;
    if (editingId) {
      updateWallet.mutate({ id: editingId, walletAddress }, {
        onSuccess: () => { setWalletAddress(''); setEditingId(null); },
      });
    } else {
      setWallet.mutate({ tokenAddress: selectedToken, walletAddress }, {
        onSuccess: () => setWalletAddress(''),
      });
    }
  };

  const isValidAddress = walletAddress.length === 42 && walletAddress.startsWith('0x');

  const tokenOptions = tokens.map(t => ({
    value: t.address,
    label: `${t.name} (${t.symbol})`,
    description: `${t.address.slice(0, 8)}...${t.address.slice(-6)}`,
  }));

  return (
    <div className="glass-card rounded-2xl p-6 border border-border/50 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Dedicated Wallets</h2>
          <p className="text-xs text-muted-foreground">Configure EVM wallet addresses per token for receiving funds</p>
        </div>
      </div>

      {isLoadingWallets ? (
        <p className="text-sm text-muted-foreground">Loading configurations...</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accepted Token</Label>
            <SearchableSelect
              options={tokenOptions}
              value={selectedToken}
              onChange={setSelectedToken}
              placeholder="Select a token..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Funding EVM Wallet Address</Label>
            <div className="relative">
              <Input
                value={walletAddress}
                onChange={e => setWalletAddress(e.target.value)}
                placeholder="0x..."
                className="bg-secondary/30 font-mono text-sm pr-10"
              />
              {isValidAddress && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
              )}
            </div>
          </div>

          <Button
            className="w-full gradient-primary rounded-xl font-bold shadow-md"
            onClick={handleSave}
            disabled={!isValidAddress || setWallet.isPending || updateWallet.isPending}
          >
            {(setWallet.isPending || updateWallet.isPending) ? 'Saving...' : editingId ? 'Update Wallet' : 'Save Wallet'}
          </Button>
        </div>
      )}

      {wallets.length > 0 && (
        <div className="pt-4 border-t border-border/50">
          <h3 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Saved Wallets</h3>
          <div className="space-y-2">
            {wallets.map(w => {
              const tokenInfo = tokens.find(t => t.address === w.tokenAddress);
              return (
                <div key={w.id} className="flex items-center justify-between rounded-xl bg-secondary/20 border border-border/30 p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {tokenInfo?.symbol?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-xs font-bold">{tokenInfo?.symbol || 'Unknown'}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{w.walletAddress.slice(0, 10)}...{w.walletAddress.slice(-6)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setSelectedToken(w.tokenAddress); setWalletAddress(w.walletAddress); setEditingId(w.id); }} className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => deleteWallet.mutate(w.id)} className="text-xs text-destructive hover:underline font-medium flex items-center gap-1">
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
