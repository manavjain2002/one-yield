import { useWallet } from "@/contexts/WalletContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAccount } from 'wagmi';

export function AuthOverlay() {
  const { needsReAuth, setNeedsReAuth, loginUser, disconnect, username } = useWallet();
  const { isConnected: isWeb3Connected } = useAccount();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isWeb3Connected) {
    if (needsReAuth) setNeedsReAuth(false);
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    
    setIsSubmitting(true);
    try {
      await loginUser(username, password);
      setNeedsReAuth(false);
      setPassword("");
      toast.success("Session restored successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to restore session");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={needsReAuth} onOpenChange={(open) => !open && setNeedsReAuth(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Session Expired
          </DialogTitle>
          <DialogDescription>
            Your session has expired or is invalid. Please enter your password to continue OR connect your wallet again.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleLogin} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <Input value={username || ""} disabled className="bg-secondary" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Restoring..." : "Restore Session"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                disconnect();
                setNeedsReAuth(false);
              }}
            >
              Sign Out & Reconnect
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
