/**
 * Hedera EVM (testnet) — align with backend `FACTORY_CONTRACT_ID` / `MOCK_USDC_EVM_ADDRESS`.
 */
export const FACTORY_CONTRACT_ADDRESS =
  (import.meta.env.VITE_FACTORY_CONTRACT_ADDRESS as string | undefined) ??
  '0xe9BE1b4E0dB6AF4123562CB01A5B44fD66606647';

export const MOCK_USDC_ADDRESS =
  (import.meta.env.VITE_MOCK_USDC_ADDRESS as string | undefined) ??
  '0x1Cf407eCB2Cd690d4E6E3F465111E019032ACA74';

/** JSON-RPC for balance display (MetaMask / Hedera EVM). */
export const HEDERA_EVM_RPC_URL =
  (import.meta.env.VITE_HEDERA_EVM_RPC_URL as string | undefined) ??
  'https://testnet.hashio.io/api';
