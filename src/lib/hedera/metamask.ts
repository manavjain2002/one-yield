/**
 * MetaMask on Hedera EVM (JSON-RPC relay). Uses personal_sign; backend verifies with ethers.
 */
import type { PairingResult } from './types';

type EthereumRequester = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumRequester | undefined {
  return (window as unknown as { ethereum?: EthereumRequester }).ethereum;
}

const HEDERA_EVM_CHAINS = {
  testnet: {
    chainId: '0x128',
    chainName: 'Hedera Testnet',
    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
    rpcUrls: ['https://testnet.hashio.io/api'],
    blockExplorerUrls: ['https://hashscan.io/testnet'],
  },
  mainnet: {
    chainId: '0x127',
    chainName: 'Hedera Mainnet',
    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
    rpcUrls: ['https://mainnet.hashio.io/api'],
    blockExplorerUrls: ['https://hashscan.io/mainnet'],
  },
} as const;

export async function pairMetaMask(): Promise<PairingResult> {
  const eth = getEthereum();
  if (!eth) {
    throw new Error('MetaMask is not installed');
  }

  const net =
    import.meta.env.VITE_HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  const chain =
    HEDERA_EVM_CHAINS[net as keyof typeof HEDERA_EVM_CHAINS] ??
    HEDERA_EVM_CHAINS.testnet;

  const overrideId = import.meta.env.VITE_HEDERA_EVM_CHAIN_ID as string | undefined;
  const chainId = overrideId?.startsWith('0x')
    ? overrideId
    : overrideId
      ? `0x${Number(overrideId).toString(16)}`
      : chain.chainId;

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId,
            chainName: chain.chainName,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: chain.rpcUrls,
            blockExplorerUrls: chain.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw e;
    }
  }

  const accounts = (await eth.request({
    method: 'eth_requestAccounts',
  })) as string[];
  const evmAddress = accounts[0];
  if (!evmAddress) {
    throw new Error('No MetaMask account');
  }

  return {
    accountId: evmAddress,
    signUtf8: async (message: string) => {
      const sig = (await eth.request({
        method: 'personal_sign',
        params: [message, evmAddress],
      })) as string;
      return sig.replace(/^0x/i, '');
    },
  };
}
