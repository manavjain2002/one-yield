/** Result of pairing with any EVM-capable wallet. */
export type PairingResult = {
  /** 0x… EVM address. */
  walletAddress: string;
  /** Returns raw signature hex (no `0x`) for POST /auth/verify. */
  signUtf8: (message: string) => Promise<string>;
};
