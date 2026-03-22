import { hedera, hederaTestnet } from 'wagmi/chains';

/** Must stay in sync with `createConfig({ chains })` in App.tsx. */
export const wagmiTargetChain =
  import.meta.env.VITE_NETWORK === 'mainnet' ? hedera : hederaTestnet;
