import { useWallet, type UserRole } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Shield, Zap, Wallet, Landmark, Loader2 } from 'lucide-react';
import { isApiConfigured } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useNavigate, useLocation } from 'react-router-dom';
import logo from '@/assets/oneyield-logo.png';

export default function LandingPage() {
  const {
    isConnected,
    address,
    accessToken,
    role,
    authHydrated,
    needsRoleSelection,
    blockWeb3AutoVerify,
    connect,
    loginUser,
    registerUser,
    selectRole,
    disconnect,
  } = useWallet();
  const [roleSubmitting, setRoleSubmitting] = useState<UserRole | null>(null);
  const [showWeb3Modal, setShowWeb3Modal] = useState(false);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [credMode, setCredMode] = useState<'login' | 'register'>('login');
  
  // Forms
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameCheckPending, setUsernameCheckPending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkUsername = useCallback(async (u: string) => {
    const t = u.trim();
    if (t.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setUsernameCheckPending(true);
    try {
      const { data } = await api.get<{ available: boolean }>('/auth/username-available', {
        params: { username: t },
      });
      setUsernameAvailable(data.available);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setUsernameCheckPending(false);
    }
  }, []);

  useEffect(() => {
    if (credMode !== 'register') {
      setUsernameAvailable(null);
      return;
    }
    const t = setTimeout(() => void checkUsername(username), 400);
    return () => clearTimeout(t);
  }, [username, credMode, checkUsername]);

  const navigate = useNavigate();
  const location = useLocation();

  /** Logged-in users should not stay on marketing home (fixes credential Web3 role screen + refresh bounce). */
  useEffect(() => {
    if (!authHydrated || location.pathname !== '/') return;
    if (!accessToken || !role) return;
    if (needsRoleSelection) return;
    const home = role === 'admin' ? '/admin' : `/${role}`;
    navigate(home, { replace: true });
  }, [authHydrated, location.pathname, accessToken, role, needsRoleSelection, navigate]);

  const handleConnectMetaMask = async () => {
    try {
      await connect();
      setShowWeb3Modal(false);
    } catch {
      setShowWeb3Modal(false);
    }
  };

  const handlePickWeb3Role = async (picked: 'lender' | 'manager') => {
    if (!isApiConfigured()) return;
    setRoleSubmitting(picked);
    try {
      await selectRole(picked);
    } finally {
      setRoleSubmitting(null);
    }
  };

  const handleCredsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (credMode === 'login') {
        const session = await loginUser(username, password);
        navigate(session.role === 'admin' ? '/admin' : '/borrower');
      } else {
        if (usernameAvailable === false) {
          return;
        }
        await registerUser(username, password, 'borrower', {
          displayName: displayName.trim(),
          email: email.trim(),
          country: country.trim(),
        });
        navigate('/borrower');
      }
      setShowCredsModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. If connected via Web3 but no token yet, show verifying state (skip after credential logout + wallet still connected)
  if (isConnected && address && !accessToken && !blockWeb3AutoVerify) {
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

      {/* First-time Web3: choose Lender vs Pool Manager (JWT needsRoleSelection) */}
      <Dialog
        open={Boolean(accessToken && needsRoleSelection && isApiConfigured())}
        onOpenChange={(open) => {
          if (!open) disconnect();
        }}
      >
        <DialogContent className="glass-card border-border/50 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Choose your role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">
            Select how you use OneYield with this wallet. You can sign in again later without choosing again.
          </p>
          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full h-12 rounded-xl font-semibold border-primary/30"
              disabled={roleSubmitting !== null}
              onClick={() => void handlePickWeb3Role('lender')}
            >
              {roleSubmitting === 'lender' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Lender'
              )}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full h-12 rounded-xl font-semibold border-primary/30"
              disabled={roleSubmitting !== null}
              onClick={() => void handlePickWeb3Role('manager')}
            >
              {roleSubmitting === 'manager' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Pool Manager'
              )}
            </Button>
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
              {credMode === 'register' && username.trim().length >= 3 && (
                <p className={`text-xs ${usernameCheckPending ? 'text-muted-foreground' : usernameAvailable === false ? 'text-destructive' : usernameAvailable === true ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {usernameCheckPending ? 'Checking availability…' : usernameAvailable === false ? 'Username is already taken' : usernameAvailable === true ? 'Username is available' : null}
                </p>
              )}
            </div>
            {credMode === 'register' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full name</label>
                  <input
                    required
                    minLength={1}
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    required
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <input
                    required
                    minLength={2}
                    placeholder="e.g. United States or US"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </>
            )}
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
              disabled={
                isSubmitting ||
                (credMode === 'register' &&
                  (usernameCheckPending ||
                    username.trim().length < 3 ||
                    usernameAvailable !== true))
              }
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