/** Result of pairing with any Hedera-capable wallet. */
export type PairingResult = {
  /** Hedera `0.0.x` id, or `0x…` for MetaMask (EVM alias). */
  accountId: string;
  /** Returns raw signature hex (no `0x`) for POST /auth/verify. */
  signUtf8: (message: string) => Promise<string>;
};
