import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Shield, Zap, ArrowRight, Wallet, Landmark } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserRole } from '@/contexts/WalletContext';
import logo from '@/assets/oneyield-logo.png';

export default function LandingPage() {
  const { isConnected, connect, selectRole } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const navigate = useNavigate();

  const handleConnectMetaMask = async () => {
    try {
      await connect();
      setShowWalletModal(false);
      setShowRoleModal(true);
    } catch {
      setShowWalletModal(false);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    await selectRole(role);
    setShowRoleModal(false);
    navigate(`/${role}`);
  };

  if (isConnected && !showRoleModal) {
    return <RoleSelection onSelect={handleRoleSelect} />;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/5 blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        {/* Logo */}
        <div className="flex items-center gap-3 animate-fade-in">
          <img src={logo} alt="OneYield" className="h-14 w-14 rounded-2xl" />
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            One<span className="gradient-text">Yield</span>
          </h1>
        </div>

        {/* Tagline */}
        <div className="max-w-2xl space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p className="text-xl font-medium text-foreground md:text-2xl">
            Institutional-Grade RWA Lending on Hedera
          </p>
          <p className="text-base text-muted-foreground">
            Transparent, on-chain lending and borrowing protocol for real-world assets.
            Powered by Hedera's enterprise-grade network.
          </p>
        </div>

        {/* Features */}
        <div className="grid max-w-xl grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {[
            { icon: Shield, label: 'Institutional Security' },
            { icon: Zap, label: 'Fast Settlements' },
            { icon: Landmark, label: 'On-Chain Transparency' },
          ].map(f => (
            <div key={f.label} className="flex flex-col items-center gap-2">
              <div className="rounded-xl bg-primary/10 p-3">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          size="lg"
          onClick={() => setShowWalletModal(true)}
          className="animate-fade-in gradient-primary h-14 rounded-2xl px-10 text-base font-semibold shadow-lg glow-primary transition-all hover:scale-105 hover:shadow-xl"
          style={{ animationDelay: '0.3s' }}
        >
          <Wallet className="mr-2 h-5 w-5" />
          Connect Wallet
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <p className="text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
          No sign-up required. Your wallet is your identity.
        </p>
      </div>

      {/* Wallet Selection Modal */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Connect Your Wallet</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <button
              type="button"
              onClick={() => void handleConnectMetaMask()}
              className="flex items-center gap-4 rounded-2xl border border-border bg-secondary/50 p-4 text-left transition-all hover:border-primary/50 hover:bg-secondary"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                <Wallet className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">MetaMask</p>
                <p className="text-xs text-muted-foreground">
                  Hedera EVM (Hashio RPC). Your 0x address maps to a Hedera account on the mirror.
                </p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>

            {/* HashPack / Blade — uncomment when re-enabled (and restore `WalletKind` + `connect(wallet)` in WalletContext).
            {[
              { id: 'hashpack' as const, name: 'HashPack', desc: 'Most popular Hedera wallet' },
              { id: 'blade' as const, name: 'Blade', desc: 'Extension or WalletConnect QR' },
            ].map(w => (
              <button key={w.id} type="button" onClick={() => handleConnect(w.id)} ... />
            ))}
            */}
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Selection Modal */}
      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
        <DialogContent className="glass-card border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Select Your Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {[
              { role: 'borrower' as UserRole, title: 'Borrower', desc: 'Create pools and borrow funds from lenders', icon: '🏦' },
              { role: 'lender' as UserRole, title: 'Lender', desc: 'Deposit funds into pools and earn yield', icon: '💰' },
              { role: 'manager' as UserRole, title: 'Pool Manager', desc: 'Manage pool operations and fund flows', icon: '⚙️' },
            ].map(r => (
              <button
                key={r.role}
                onClick={() => handleRoleSelect(r.role)}
                className="flex items-center gap-4 rounded-2xl border border-border bg-secondary/50 p-5 text-left transition-all hover:border-primary/50 hover:bg-secondary"
              >
                <span className="text-3xl">{r.icon}</span>
                <div>
                  <p className="font-semibold text-foreground">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.desc}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleSelection({ onSelect }: { onSelect: (role: UserRole) => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome to OneYield</h1>
          <p className="text-muted-foreground">Select your role to continue</p>
        </div>
        <div className="grid gap-3">
          {[
            { role: 'borrower' as UserRole, title: 'Borrower', desc: 'Create pools and borrow funds from lenders', icon: '🏦' },
            { role: 'lender' as UserRole, title: 'Lender', desc: 'Deposit funds into pools and earn yield', icon: '💰' },
            { role: 'manager' as UserRole, title: 'Pool Manager', desc: 'Manage pool operations and fund flows', icon: '⚙️' },
          ].map(r => (
            <button
              key={r.role}
              onClick={() => onSelect(r.role)}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:bg-secondary"
            >
              <span className="text-3xl">{r.icon}</span>
              <div>
                <p className="font-semibold text-foreground">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}