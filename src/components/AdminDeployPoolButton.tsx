import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import type { AdminPoolDraftDetail } from '@/hooks/useAdminPoolActions';

type Props = {
  draft: AdminPoolDraftDetail;
  disabled?: boolean;
  isPending: boolean;
  onDeploy: (draft: AdminPoolDraftDetail) => void;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  labelConnected?: string;
  labelDeployed?: string;
};

/**
 * Shows Connect Wallet until wagmi is connected, then runs factory deploy (MetaMask tx).
 */
export function AdminDeployPoolButton({
  draft,
  disabled,
  isPending,
  onDeploy,
  className,
  size = 'default',
  labelConnected = 'Create Pool on Chain',
  labelDeployed = 'Already Deployed',
}: Props) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  if (!isConnected) {
    return (
      <Button
        type="button"
        className={className}
        size={size}
        onClick={() => openConnectModal?.()}
      >
        Connect Wallet
      </Button>
    );
  }

  const isDeployed = draft.indexed;
  return (
    <Button
      type="button"
      className={className}
      size={size}
      disabled={disabled || isPending || isDeployed}
      onClick={() => onDeploy(draft)}
    >
      {isPending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Deploying...
        </span>
      ) : isDeployed ? (
        labelDeployed
      ) : (
        labelConnected
      )}
    </Button>
  );
}
