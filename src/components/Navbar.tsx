import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Wallet, LogOut, Menu, X,
  TrendingUp, Briefcase, PieChart
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import logo from '@/assets/oneyield-logo.png';

const roleNavItems = {
  borrower: [
    { label: 'Dashboard', path: '/borrower', icon: LayoutDashboard },
    { label: 'My Pools', path: '/borrower/pools', icon: Briefcase },
  ],
  lender: [
    { label: 'Dashboard', path: '/lender', icon: LayoutDashboard },
    { label: 'Earn', path: '/lender/pools', icon: TrendingUp },
    { label: 'Portfolio', path: '/lender/portfolio', icon: PieChart },
  ],
  manager: [
    { label: 'Dashboard', path: '/manager', icon: LayoutDashboard },
    { label: 'Pools', path: '/manager/pools', icon: Briefcase },
  ],
};

export function Navbar() {
  const { address, role, network, balance, disconnect } = useWallet();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = role ? roleNavItems[role] : [];

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="OneYield" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold tracking-tight">
              One<span className="gradient-text">Yield</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Network Badge */}
            <div className="hidden items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 sm:flex">
              <span className={cn('h-2 w-2 rounded-full', network === 'mainnet' ? 'bg-success' : 'bg-warning')} />
              <span className="text-xs font-medium text-muted-foreground capitalize">{network}</span>
            </div>

            {/* Balance */}
            <div className="hidden rounded-full border border-border bg-secondary px-3 py-1.5 lg:block">
              <span className="text-xs font-medium text-foreground">{balance.toLocaleString()} ℏ</span>
            </div>

            {/* Wallet Address */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">{address?.slice(0, 8)}...</span>
            </div>

            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={disconnect} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Mobile Menu Toggle */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="border-t border-border bg-background p-4 md:hidden">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium',
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Low balance warning */}
      {balance < 1 && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs font-medium text-warning">
          ⚠️ Low HBAR balance. You may not have enough to cover transaction fees.
        </div>
      )}
    </>
  );
}