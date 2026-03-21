export const TX_QUEUE = 'blockchain-tx';

export interface TxJobPayload {
  /** Which platform signer to use (e.g. 'pool_manager', 'oracle'). */
  signerKey: string;
  /** Target contract address (0x…). */
  contractAddress: string;
  /** Which ABI to use: 'factory' | 'pool' | 'fund_manager'. */
  abi: 'factory' | 'pool' | 'fund_manager';
  /** Solidity function name to call. */
  functionName: string;
  /** JSON-serializable function arguments. */
  args: unknown[];
  /** Optional metadata for correlating results. */
  meta?: {
    poolId?: string;
    draftId?: string;
    userId?: string;
  };
}
