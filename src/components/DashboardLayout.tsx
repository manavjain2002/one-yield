import { Navbar } from '@/components/Navbar';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8 lg:px-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors pl-0 hover:bg-transparent font-bold text-xs uppercase tracking-widest"
          >
            <div className="p-1.5 rounded-lg bg-secondary/30 group-hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Back
          </Button>
        </div>
        {children}
      </main>
      <footer className="mt-auto border-t border-border/50 bg-background/50 px-4 py-6">
        <div className="mx-auto max-w-7xl text-center text-xs text-muted-foreground">
          <p>⚠️ Smart contract risk disclaimer: Funds are managed by on-chain smart contracts. Use at your own risk.</p>
          <p className="mt-1">All funds are on-chain and verifiable on <a href="https://hashscan.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">HashScan</a>.</p>
        </div>
      </footer>
    </div>
  );
}