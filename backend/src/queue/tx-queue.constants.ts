export const HEDERA_TX_QUEUE = 'hedera-tx';

export interface HederaTxJobPayload {
  walletKey: string;
  contractId: string;
  functionName: string;
  /** hex-encoded function parameters (selector + args) */
  payloadHex: string;
  poolAddress?: string;
  userId?: string;
  /** Links createPool job to pool_drafts for indexer correlation */
  draftId?: string;
}
