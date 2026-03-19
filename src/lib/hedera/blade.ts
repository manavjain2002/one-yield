/**
 * Blade Wallet via @bladelabs/blade-web3.js (extension or WalletConnect QR).
 * Peer: @hashgraph/sdk (installed at app root).
 */
import type { PairingResult } from './types';

function u8ToHex(u: Uint8Array): string {
  return [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function pairBlade(): Promise<PairingResult> {
  const { BladeConnector, ConnectorStrategy } = await import(
    '@bladelabs/blade-web3.js'
  );

  const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
    | string
    | undefined;

  const connector = await BladeConnector.init(
    ConnectorStrategy.AUTO,
    {
      name: 'OneYield',
      description: 'Institutional lending on Hedera',
      url: window.location.origin,
      icons: [`${window.location.origin}/placeholder.svg`],
    },
    projectId,
  );

  const accountIds = await connector.createSession();
  const signer = connector.getSigners()[0];
  if (!signer || !accountIds?.length) {
    throw new Error('Blade did not return a signer');
  }

  const accountId = accountIds[0];

  return {
    accountId,
    signUtf8: async (message: string) => {
      const msgBytes = new TextEncoder().encode(message);
      const sigs = await signer.sign([msgBytes]);
      const first = sigs[0];
      if (!first?.signature) {
        throw new Error('Blade did not return a signature');
      }
      return u8ToHex(new Uint8Array(first.signature));
    },
  };
}
