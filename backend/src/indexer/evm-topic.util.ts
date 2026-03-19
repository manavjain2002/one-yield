import { ContractId } from '@hashgraph/sdk';

/** Last 20 bytes of a 32-byte log topic as 0x + 40 hex chars */
export function topicToEvmAddress(topic: string): string {
  const hex = topic.replace(/^0x/, '');
  const addr = hex.slice(-40);
  return `0x${addr}`;
}

export function evmAddressToContractId(evmAddress: string): string {
  const id = ContractId.fromEvmAddress(0, 0, evmAddress);
  return id.toString();
}
