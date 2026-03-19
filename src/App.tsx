import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";
import { isApiConfigured } from "@/lib/api";
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
import NotFound from "./pages/NotFound";

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
  useEventsSocket(Boolean(accessToken && import.meta.env.VITE_WS_URL));
  return null;
}

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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WalletProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <EventsBridge />
          <AppRoutes />
        </BrowserRouter>
      </WalletProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
