/**
 * HashPack via HashConnect v1.x (@hashgraph/hashconnect).
 * Flow: register pairing listener → init → connectToLocalWallet().
 */
import type { PairingResult } from './types';

function u8ToHex(u: Uint8Array): string {
  return [...u].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeSigHex(sig: string | Uint8Array | undefined): string {
  if (!sig) throw new Error('Wallet did not return a signature');
  if (typeof sig === 'string') return sig.replace(/^0x/i, '');
  return u8ToHex(sig);
}

export async function pairHashPack(): Promise<PairingResult> {
  const { HashConnect } = await import('@hashgraph/hashconnect');
  const hc = new HashConnect(false);

  const network =
    import.meta.env.VITE_HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';

  const metadata = {
    name: 'OneYield',
    description: 'Institutional lending on Hedera',
    icon: `${window.location.origin}/placeholder.svg`,
    url: window.location.origin,
  };

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('HashPack pairing timed out'));
    }, 120_000);

    let settled = false;

    const finish = (accountId: string, topic: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (!accountId) {
        reject(new Error('No account returned from HashPack'));
        return;
      }
      resolve({
        accountId,
        signUtf8: async (message: string) => {
          const res = await hc.sign(topic, accountId, message);
          if (!res.success) {
            throw new Error(res.error ?? 'HashPack signing failed');
          }
          return normalizeSigHex(res.userSignature);
        },
      });
    };

    hc.pairingEvent.once((data) => {
      const accountId = data.accountIds?.[0];
      if (accountId) finish(accountId, data.topic);
    });

    hc.init(metadata, network, true)
      .then((initData) => {
        if (!settled && initData.savedPairings?.length) {
          const p = initData.savedPairings[0];
          const accountId = p.accountIds?.[0];
          if (accountId) {
            finish(accountId, p.topic);
            return;
          }
        }
        if (!settled) {
          hc.connectToLocalWallet();
        }
      })
      .catch((e) => {
        window.clearTimeout(timeout);
        if (!settled) reject(e);
      });
  });
}
