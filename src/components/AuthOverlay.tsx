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

export function AuthOverlay() {
  const { needsReAuth, setNeedsReAuth, loginUser, disconnect, username } = useWallet();
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setIsSubmitting(true);
    try {
      await loginUser(username, password);
      setNeedsReAuth(false);
      setPassword("");
      toast.success("Session restored successfully");
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message)
          : null;
      toast.error(msg || "Failed to restore session");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={needsReAuth} onOpenChange={(open) => !open && setNeedsReAuth(false)}>
      <DialogContent className="sm:max-w-md">
        {username ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Session Expired
              </DialogTitle>
              <DialogDescription>
                Your session has expired or is invalid. Enter your password to continue. You can still use a connected wallet in the app for transactions after you restore your session.
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Session Expired
              </DialogTitle>
              <DialogDescription>
                Your wallet session is no longer valid. Sign out and use Web3 Login again to verify your wallet.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-4">
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  disconnect();
                  setNeedsReAuth(false);
                }}
              >
                Sign out and return to home
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
