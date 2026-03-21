import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  POOL_FACTORY_ABI,
  LENDING_POOL_ABI,
  ASSET_MANAGER_ABI,
  ERC20_ABI,
} from './abis';

/** Known platform signer keys loaded from environment. */
export type SignerKey =
  | 'role_manager'
  | 'pool_manager'
  | 'oracle'
  | 'fm_admin';

/**
 * Central service for all smart-contract interactions.
 *
 * Usage:
 *   // Read call — no signer needed
 *   const pool = this.contracts.pool(address);
 *   const aum = await pool.assetUnderManagement();
 *
 *   // Write call — platform signer
 *   const pool = this.contracts.pool(address, 'pool_manager');
 *   const tx = await pool.activatePool();
 *   await tx.wait();
 *
 *   // Generic contract
 *   const c = this.contracts.get(address, MY_ABI);            // read
 *   const c = this.contracts.get(address, MY_ABI, 'oracle');   // write
 */
@Injectable()
export class ContractService implements OnModuleInit {
  private readonly logger = new Logger(ContractService.name);
  private provider: ethers.JsonRpcProvider;
  private readonly wallets = new Map<string, ethers.Wallet>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const rpcUrl =
      this.config.get<string>('blockchain.rpcUrl') ??
      'https://testnet.hashio.io/api';
    this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });

    this.loadKey('role_manager', 'ROLE_MANAGER_PRIVATE_KEY');
    this.loadKey('pool_manager', 'POOL_MANAGER_PRIVATE_KEY');
    this.loadKey('oracle', 'ORACLE_PRIVATE_KEY');
    this.loadKey('fm_admin', 'FM_ADMIN_PRIVATE_KEY');
  }

  private loadKey(key: SignerKey, envVar: string) {
    const pk = this.config.get<string>(envVar);
    if (!pk) {
      this.logger.warn(`Signer "${key}" not configured (${envVar})`);
      return;
    }
    try {
      const wallet = new ethers.Wallet(pk, this.provider);
      this.wallets.set(key, wallet);
      this.logger.log(`Signer "${key}" loaded → ${wallet.address}`);
    } catch (e) {
      this.logger.error(`Failed to load signer "${key}": ${e}`);
    }
  }

  // ─── Core API ────────────────────────────────────────────

  /** Get a contract instance. If signerKey is given, the contract can send txs. */
  get(
    address: string,
    abi: readonly string[],
    signerKey?: string,
  ): ethers.Contract {
    const runner = signerKey ? this.getSigner(signerKey) : this.provider;
    return new ethers.Contract(address, [...abi], runner);
  }

  // ─── Convenience getters for each contract type ──────────

  /** PoolFactory contract. */
  factory(signerKey?: string): ethers.Contract {
    const addr = this.config.get<string>('blockchain.factoryAddress');
    if (!addr) throw new Error('FACTORY_ADDRESS not configured');
    return this.get(addr, POOL_FACTORY_ABI, signerKey);
  }

  /** LendingPool contract at a specific address. */
  pool(address: string, signerKey?: string): ethers.Contract {
    return this.get(address, LENDING_POOL_ABI, signerKey);
  }

  /** FundManager contract at a specific address. */
  fundManager(address: string, signerKey?: string): ethers.Contract {
    return this.get(address, ASSET_MANAGER_ABI, signerKey);
  }

  /** ERC20 token contract. */
  erc20(address: string, signerKey?: string): ethers.Contract {
    return this.get(address, ERC20_ABI, signerKey);
  }

  // ─── Low-level helpers ───────────────────────────────────

  /** Get the JSON-RPC provider. */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /** Get a signer wallet by key. Throws if not configured. */
  getSigner(key: string): ethers.Wallet {
    const w = this.wallets.get(key);
    if (!w) throw new Error(`Signer "${key}" not configured`);
    return w;
  }

  /** Check if a signer key is available. */
  hasSigner(key: string): boolean {
    return this.wallets.has(key);
  }

  /** Get the factory contract address from config. */
  factoryAddress(): string {
    const addr = this.config.get<string>('blockchain.factoryAddress');
    if (!addr) throw new Error('FACTORY_ADDRESS not configured');
    return addr;
  }

  /** Encode function data for a given ABI (useful for building tx params for frontend). */
  encode(
    abi: readonly string[],
    functionName: string,
    args: unknown[],
  ): string {
    const iface = new ethers.Interface([...abi]);
    return iface.encodeFunctionData(functionName, args);
  }

  /** Parse a log using an ABI. */
  parseLog(
    abi: readonly string[],
    log: { topics: string[]; data: string },
  ): ethers.LogDescription | null {
    const iface = new ethers.Interface([...abi]);
    try {
      return iface.parseLog(log);
    } catch {
      return null;
    }
  }
}
