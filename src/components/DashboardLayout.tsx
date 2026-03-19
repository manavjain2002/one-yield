import { Navbar } from '@/components/Navbar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8 lg:px-8">
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