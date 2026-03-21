import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useBorrowerWallets, useSetBorrowerWallet } from '@/hooks/useBorrowerWallets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  const [selectedToken, setSelectedToken] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  // Default select first token
  useEffect(() => {
    if (tokens.length > 0 && !selectedToken) {
      setSelectedToken(tokens[0].address);
    }
  }, [tokens]);

  // Load existing wallet address for token
  useEffect(() => {
    if (selectedToken) {
      const existing = wallets.find(w => w.tokenAddress === selectedToken);
      setWalletAddress(existing?.walletAddress || '');
    }
  }, [selectedToken, wallets]);

  const handleSave = () => {
    if (!selectedToken || !walletAddress) return;
    setWallet.mutate({ tokenAddress: selectedToken, walletAddress });
  };

  return (
    <div className="space-y-4 glass-card rounded-2xl p-5 border border-border">
      <div>
        <h2 className="text-lg font-semibold">Dedicated Wallets</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure physical EVM wallet addresses used to receive payloads per token.</p>
      </div>
      
      {isLoadingWallets ? (
        <p className="text-sm text-muted-foreground">Loading configurations...</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Accepted Token</Label>
            <select
              value={selectedToken}
              onChange={e => setSelectedToken(e.target.value)}
              className="bg-secondary/50 border-border flex h-10 w-full rounded-md border text-sm px-3 py-2 focus:ring-2 focus:ring-primary outline-none"
            >
              {tokens.map(t => (
                <option key={t.address} value={t.address}>
                  {t.name} ({t.symbol})
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <Label>Funding EVM Wallet Address</Label>
            <Input 
              value={walletAddress}
              onChange={e => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className="bg-secondary/50 font-mono text-sm"
            />
          </div>
          
          <Button 
            className="w-full" 
            onClick={handleSave} 
            disabled={!walletAddress || setWallet.isPending || (walletAddress.length !== 42)}
          >
            {setWallet.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      )}

      {wallets.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-sm font-semibold mb-3">Saved Configurations</h3>
          <div className="space-y-3">
            {wallets.map(w => {
              const tokenInfo = tokens.find(t => t.address === w.tokenAddress);
              return (
                <div key={w.id} className="bg-secondary/30 rounded-xl p-3 flex flex-col space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>{tokenInfo?.symbol || 'Unknown Token'}</span>
                  </div>
                  <span className="text-sm font-mono break-all">{w.walletAddress}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
