import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";
import { isApiConfigured } from "@/lib/api";
import { resolvedWsBase } from "@/lib/api-env";
import { useEventsSocket } from "@/hooks/useEventsSocket";
import LandingPage from "./pages/LandingPage";
import BorrowerDashboard from "./pages/borrower/BorrowerDashboard";
import BorrowerPools from "./pages/borrower/BorrowerPools";
import PoolDetail from "./pages/borrower/PoolDetail";
import LenderDashboard from "./pages/lender/LenderDashboard";
import LenderPools from "./pages/lender/LenderPools";
import LenderPortfolio from "./pages/lender/LenderPortfolio";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import ManagerPools from "./pages/manager/ManagerPools";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPoolDraftsPage from "./pages/admin/AdminPoolDraftsPage";
import AdminDraftDetailPage from "./pages/admin/AdminDraftDetailPage";
import AdminPoolDetailPage from "./pages/admin/AdminPoolDetailPage";
import HistoryPage from "./pages/History";
import NotFound from "./pages/NotFound";

import '@rainbow-me/rainbowkit/styles.css';
import { 
  RainbowKitProvider, 
  darkTheme,
  connectorsForWallets
} from '@rainbow-me/rainbowkit';
import { 
  metaMaskWallet, 
  walletConnectWallet,
  rainbowWallet,
  coinbaseWallet 
} from '@rainbow-me/rainbowkit/wallets';
import { WagmiProvider, http, createConfig } from 'wagmi';
import { wagmiTargetChain } from '@/lib/wagmi-target-chain';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

const wallets = [
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
];

if (projectId) {
  wallets.push(walletConnectWallet);
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: wallets,
    },
  ],
  {
    appName: 'OneYield',
    projectId: projectId || '00000000000000000000000000000000', 
  }
);

const config = createConfig({
  connectors,
  chains: [wagmiTargetChain],
  transports: {
    [wagmiTargetChain.id]: http(),
  },
  // Ensure we don't try to auto-connect to WalletConnect if no ID
  ssr: true, 
});

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: string }) {
  const { isConnected, role, accessToken } = useWallet();
  const bypassJwt =
    !isApiConfigured() || import.meta.env.VITE_USE_MOCK_WALLET === "true";
  if (!isConnected) return <Navigate to="/" replace />;
  if (!bypassJwt && !accessToken) return <Navigate to="/" replace />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function EventsBridge() {
  const { accessToken } = useWallet();
  useEventsSocket(Boolean(accessToken && resolvedWsBase()));
  return null;
}

import { AuthOverlay } from "./components/AuthOverlay";
import { TransactionProvider } from "./contexts/TransactionContext";
import { TransactionOverlay } from "./components/TransactionOverlay";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/borrower" element={<ProtectedRoute allowedRole="borrower"><BorrowerDashboard /></ProtectedRoute>} />
      <Route path="/borrower/pools" element={<ProtectedRoute allowedRole="borrower"><BorrowerPools /></ProtectedRoute>} />
      <Route path="/borrower/pools/:poolId" element={<ProtectedRoute allowedRole="borrower"><PoolDetail /></ProtectedRoute>} />
      <Route path="/lender" element={<ProtectedRoute allowedRole="lender"><LenderDashboard /></ProtectedRoute>} />
      <Route path="/lender/pools" element={<ProtectedRoute allowedRole="lender"><LenderPools /></ProtectedRoute>} />
      <Route path="/lender/portfolio" element={<ProtectedRoute allowedRole="lender"><LenderPortfolio /></ProtectedRoute>} />
      <Route path="/manager" element={<ProtectedRoute allowedRole="manager"><ManagerDashboard /></ProtectedRoute>} />
      <Route path="/manager/pools" element={<ProtectedRoute allowedRole="manager"><ManagerPools /></ProtectedRoute>} />

      <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/pools/:id" element={<ProtectedRoute allowedRole="admin"><AdminPoolDetailPage /></ProtectedRoute>} />
      <Route path="/admin/pool-drafts" element={<ProtectedRoute allowedRole="admin"><AdminPoolDraftsPage /></ProtectedRoute>} />
      <Route path="/admin/pool-drafts/:draftId" element={<ProtectedRoute allowedRole="admin"><AdminDraftDetailPage /></ProtectedRoute>} />
      
      {/* Universal History */}
      <Route path="/lender/history" element={<ProtectedRoute allowedRole="lender"><HistoryPage /></ProtectedRoute>} />
      <Route path="/borrower/history" element={<ProtectedRoute allowedRole="borrower"><HistoryPage /></ProtectedRoute>} />
      <Route path="/manager/history" element={<ProtectedRoute allowedRole="manager"><HistoryPage /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import { ThemeProvider, useTheme } from "next-themes";
import { lightTheme } from '@rainbow-me/rainbowkit';

function RainbowKitWrapper({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <RainbowKitProvider 
      theme={resolvedTheme === 'light' ? lightTheme({
        accentColor: 'hsl(var(--primary))',
        borderRadius: 'large',
      }) : darkTheme({
        accentColor: 'hsl(var(--primary))',
        borderRadius: 'large',
      })}
    >
      {children}
    </RainbowKitProvider>
  );
}

const App = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <RainbowKitWrapper>
          <TooltipProvider>
            <WalletProvider>
              <TransactionProvider>
                <AuthOverlay />
                <TransactionOverlay />
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <EventsBridge />
                  <AppRoutes />
                </BrowserRouter>
              </TransactionProvider>
            </WalletProvider>
          </TooltipProvider>
        </RainbowKitWrapper>
      </ThemeProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;
