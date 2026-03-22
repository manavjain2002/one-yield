/**
 * Frontend contract interaction layer.
 *
 * Usage:
 *   import { getPoolFactory, getLendingPool, getERC20, getProvider, getSigner } from '@/lib/contracts';
 *
 *   // Read call (no wallet needed)
 *   const factory = getReadContract(FACTORY_ADDR, POOL_FACTORY_ABI);
 *   const total = await factory.totalV1Pools();
 *
 *   // Write call (MetaMask signer)
 *   const factory = await getPoolFactory();
 *   const tx = await factory.createPool(...args);
 *   await tx.wait();
 *
 *   // ERC20 approval
 *   const token = await getERC20(tokenAddress);
 *   const tx = await token.approve(spender, amount);
 *   await tx.wait();
 */

import { BrowserProvider, JsonRpcProvider, Contract } from 'ethers';
import type { Signer } from 'ethers';
import {
  POOL_FACTORY_ABI,
  LENDING_POOL_ABI,
  ASSET_MANAGER_ABI,
  ERC20_ABI,
} from './abis';
import {
  FACTORY_CONTRACT_ADDRESS,
  RPC_URL,
} from '@/lib/chain-constants';

// ─── Provider & Signer ──────────────────────────────────────

/** Get a read-only JSON-RPC provider (no wallet needed). */
export function getReadProvider(): JsonRpcProvider {
  const provider = new JsonRpcProvider(RPC_URL, { chainId: 296, name: 'hedera-testnet' }, { staticNetwork: true });
  // Hedera doesn't support ENS -- suppress all resolution attempts
  provider.getResolver = async () => null;
  return provider;
}

/** Get EIP-1193 browser provider from MetaMask. */
export function getProvider(): BrowserProvider {
  const eth = (window as unknown as { ethereum?: { request: (...args: unknown[]) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error('MetaMask is not installed');
  const provider = new BrowserProvider(eth, { chainId: 296, name: 'hedera-testnet' });
  provider.getResolver = async () => null;
  return provider;
}

/** Get signer from MetaMask (prompts user to connect if needed). */
export async function getSigner(): Promise<Signer> {
  const provider = getProvider();
  return provider.getSigner();
}

// ─── Generic Contract Getters ───────────────────────────────

/** 
 * Wraps an ethers Contract to log all function calls.
 */
function wrapWithLogging(contract: Contract, address: string, isWrite: boolean): Contract {
  const handler: ProxyHandler<any> = {
    get(target, propKey) {
      const originalValue = target[propKey];
      if (typeof originalValue === 'function' && typeof propKey === 'string') {
        return async (...args: any[]) => {
          const typeLabel = isWrite ? 'Sending TX' : 'Reading Data';
          console.group(`%c[Blockchain] ${typeLabel}: ${propKey}`, 'color: #8b5cf6; font-weight: bold;');
          console.log(`%cTarget:`, 'font-weight: bold;', address);
          console.log(`%cArgs:`, 'font-weight: bold;', args);
          
          try {
            const result = await originalValue.apply(target, args);
            console.log(`%cResult:`, 'font-weight: bold; color: #10b981;', result);
            if (result && typeof result.wait === 'function') {
              console.log(`%cTransaction Hash:`, 'font-weight: bold;', result.hash);
            }
            console.groupEnd();
            return result;
          } catch (error: any) {
            console.error(`%cError calling ${propKey}:`, 'font-weight: bold; color: #ef4444;', error);
            console.groupEnd();
            throw error;
          }
        };
      }
      return originalValue;
    },
  };
  return new Proxy(contract, handler);
}

/** Get a read-only contract (uses JSON-RPC, no wallet). */
export function getReadContract(address: string, abi: readonly string[]): Contract {
  const contract = new Contract(address, [...abi], getReadProvider());
  return wrapWithLogging(contract, address, false);
}

/** Get a writable contract connected to MetaMask signer. */
export async function getWriteContract(address: string, abi: readonly string[]): Promise<Contract> {
  const signer = await getSigner();
  const contract = new Contract(address, [...abi], signer);
  return wrapWithLogging(contract, address, true);
}

// ─── Convenience Getters ────────────────────────────────────

/** Get PoolFactory (writable — connected to MetaMask). */
export async function getPoolFactory(): Promise<Contract> {
  return getWriteContract(FACTORY_CONTRACT_ADDRESS, POOL_FACTORY_ABI);
}

/** Get PoolFactory (read-only). */
export function getPoolFactoryRead(): Contract {
  return getReadContract(FACTORY_CONTRACT_ADDRESS, POOL_FACTORY_ABI);
}

/** Get a LendingPool contract (writable). */
export async function getLendingPool(poolAddress: string): Promise<Contract> {
  return getWriteContract(poolAddress, LENDING_POOL_ABI);
}

/** Get a LendingPool contract (read-only). */
export function getLendingPoolRead(poolAddress: string): Contract {
  return getReadContract(poolAddress, LENDING_POOL_ABI);
}

/** Get an ERC20 token contract (writable). */
export async function getERC20(tokenAddress: string): Promise<Contract> {
  return getWriteContract(tokenAddress, ERC20_ABI);
}

/** Get an ERC20 token contract (read-only). */
export function getERC20Read(tokenAddress: string): Contract {
  return getReadContract(tokenAddress, ERC20_ABI);
}

/** Get an AssetManager contract (writable). */
export async function getAssetManager(amAddress: string): Promise<Contract> {
  return getWriteContract(amAddress, ASSET_MANAGER_ABI);
}

/** Get an AssetManager contract (read-only). */
export function getAssetManagerRead(amAddress: string): Contract {
  return getReadContract(amAddress, ASSET_MANAGER_ABI);
}
