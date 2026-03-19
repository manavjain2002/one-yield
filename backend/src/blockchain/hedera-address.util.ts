import { AccountId, ContractId } from '@hashgraph/sdk';

/** Convert 0.0.x Hedera id to 0x-prefixed 40-char EVM address for ABI encoding */
export function hederaIdToEvmAddress(id: string): `0x${string}` {
  const trimmed = id.trim();
  if (trimmed.startsWith('0x')) {
    return trimmed as `0x${string}`;
  }
  try {
    if (trimmed.includes('.')) {
      const account = AccountId.fromString(trimmed);
      const solidity = account.toSolidityAddress();
      return `0x${solidity}` as `0x${string}`;
    }
  } catch {
    /* fall through */
  }
  throw new Error(`Invalid Hedera account/contract id: ${id}`);
}

export function contractIdFromString(id: string): ContractId {
  return ContractId.fromString(id.trim());
}
