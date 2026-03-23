/**
 * EVM chain constants for contract interactions.
 */
export const FACTORY_CONTRACT_ADDRESS =
  (import.meta.env.VITE_FACTORY_CONTRACT_ADDRESS as string | undefined) ??
  '0xe9BE1b4E0dB6AF4123562CB01A5B44fD66606647';

export const POOL_TOKEN_ADDRESS =
  (import.meta.env.VITE_POOL_TOKEN_ADDRESS as string | undefined) ??
  '0x1Cf407eCB2Cd690d4E6E3F465111E019032ACA74';

/** JSON-RPC endpoint for reads / balance display. */
export const RPC_URL =
  (import.meta.env.VITE_RPC_URL as string | undefined) ??
  'https://testnet.hashio.io/api';

/** EVM address that holds mock USDC for the public faucet (balance shown on `/faucet`). */
export const FAUCET_WALLET_ADDRESS =
  '0x9df086c2768c43fDA6FD1E7d9d104b432606B441';
