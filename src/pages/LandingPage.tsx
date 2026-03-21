import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Shield, Zap, ArrowRight, Wallet, Landmark } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserRole } from '@/contexts/WalletContext';
import logo from '@/assets/oneyield-logo.png';

export default function LandingPage() {
  const { isConnected, address, accessToken, connect, selectRole, loginUser, registerUser } = useWallet();
  const [showWeb3Modal, setShowWeb3Modal] = useState(false);
  const [showWeb3RoleModal, setShowWeb3RoleModal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [credMode, setCredMode] = useState<'login' | 'register'>('login');
  
  // Forms
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleConnectMetaMask = async () => {
    try {
      await connect();
      setShowWeb3Modal(false);
      // We don't show the role modal here anymore, because we wait for the accessToken
    } catch {
      setShowWeb3Modal(false);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    await selectRole(role);
    setShowWeb3RoleModal(false);
    navigate(`/${role}`);
  };

  const handleCredsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (credMode === 'login') {
        await loginUser(username, password);
        navigate(username === 'oyAdmin' ? '/manager' : '/borrower');
      } else {
        await registerUser(username, password, 'borrower');
        navigate('/borrower');
      }
      setShowCredsModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. If connected via Web3 but no token yet, show verifying state
  if (isConnected && address && !accessToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-6 text-center animate-in fade-in duration-700">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
            <Shield className="relative h-16 w-16 text-primary animate-bounce-slow" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Verifying Identity</h2>
            <p className="text-muted-foreground max-w-xs">
              Please sign the authentication message in your wallet to continue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. If connected (Web3 token or ID/Pass) but no role selected, show role selection
  if (isConnected && !showWeb3RoleModal) {
    return <RoleSelection onSelect={handleRoleSelect} isWeb3={!!address} />;
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
            Institutional-Grade RWA Lending
          </p>
          <p className="text-base text-muted-foreground">
            Transparent, on-chain lending and borrowing protocol for real-world assets.
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
        <div className="flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Button
            size="lg"
            onClick={() => void connect()}
            className="gradient-primary h-14 rounded-2xl px-8 text-base font-semibold shadow-lg glow-primary transition-all hover:scale-105 hover:shadow-xl"
          >
            <Wallet className="mr-2 h-5 w-5" />
            Web3 Login
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            onClick={() => { setCredMode('login'); setShowCredsModal(true); }}
            className="h-14 rounded-2xl px-8 text-base font-semibold border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all hover:scale-105"
          >
            <Shield className="mr-2 h-5 w-5" />
            Borrower / Admin Login
          </Button>
        </div>
        <p className="text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
          Lenders & Pool Managers use Web3. Borrowers & Admin use ID/Password.
        </p>
      </div>

      {/* Web3 Role Selection Modal */}
      <Dialog open={showWeb3RoleModal} onOpenChange={setShowWeb3RoleModal}>
        <DialogContent className="glass-card border-border/50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Select Your Web3 Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {[
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

      {/* Credentials Modal (Borrowers/Admin) */}
      <Dialog open={showCredsModal} onOpenChange={setShowCredsModal}>
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              {credMode === 'login' ? 'Welcome Back' : 'Create Borrower Account'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-center gap-4 mb-4">
            <button 
              className={`text-sm font-semibold pb-1 ${credMode === 'login' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
              onClick={() => setCredMode('login')}
            >
              Login
            </button>
            <button 
              className={`text-sm font-semibold pb-1 ${credMode === 'register' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
              onClick={() => setCredMode('register')}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleCredsSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <input 
                required 
                minLength={3}
                placeholder="Enter username" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input 
                required 
                minLength={6}
                type="password" 
                placeholder="Enter password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none" 
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full gradient-primary h-12 rounded-xl text-base font-semibold"
            >
              {isSubmitting ? 'Processing...' : (credMode === 'login' ? 'Login' : 'Register')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleSelection({ onSelect, isWeb3 }: { onSelect: (role: UserRole) => void; isWeb3?: boolean }) {
  const roles = [
    { role: 'lender' as UserRole, title: 'Lender', desc: 'Deposit funds into pools and earn yield', icon: '💰' },
    { role: 'manager' as UserRole, title: 'Pool Manager', desc: 'Manage pool operations and fund flows', icon: '⚙️' },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Welcome to OneYield</h1>
          <p className="text-muted-foreground">Select your role to continue</p>
        </div>
        <div className="grid gap-3">
          {roles.map(r => (
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