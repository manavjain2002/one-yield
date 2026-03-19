import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountId, PrivateKey } from '@hashgraph/sdk';

export type KnownSignerKey =
  | 'platform_admin'
  | 'role_manager'
  | 'pool_manager'
  | 'oracle'
  | 'fm_admin';

export interface SignerCredentials {
  accountId: AccountId;
  privateKey: PrivateKey;
}

/**
 * Loads platform signer keys from environment (dev).
 * Production: replace with Vault / AWS Secrets Manager provider.
 */
@Injectable()
export class SignerService implements OnModuleInit {
  private readonly logger = new Logger(SignerService.name);
  private readonly signers = new Map<string, SignerCredentials>();
  private readonly dedicatedKeys = new Map<string, PrivateKey>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.registerIfPresent(
      'platform_admin',
      'PLATFORM_ADMIN_ACCOUNT_ID',
      'PLATFORM_ADMIN_PRIVATE_KEY',
    );
    this.registerIfPresent(
      'role_manager',
      'ROLE_MANAGER_ACCOUNT_ID',
      'ROLE_MANAGER_PRIVATE_KEY',
    );
    this.registerIfPresent(
      'pool_manager',
      'POOL_MANAGER_ACCOUNT_ID',
      'POOL_MANAGER_PRIVATE_KEY',
    );
    this.registerIfPresent(
      'oracle',
      'ORACLE_ACCOUNT_ID',
      'ORACLE_PRIVATE_KEY',
    );
    this.registerIfPresent(
      'fm_admin',
      'FM_ADMIN_ACCOUNT_ID',
      'FM_ADMIN_PRIVATE_KEY',
    );

    const dedicatedJson =
      this.config.get<string>('DEDICATED_WALLETS_JSON') ??
      process.env.DEDICATED_WALLETS_JSON;
    if (dedicatedJson) {
      try {
        const arr = JSON.parse(dedicatedJson) as {
          accountId: string;
          privateKey: string;
        }[];
        for (const d of arr) {
          if (d.accountId && d.privateKey) {
            this.dedicatedKeys.set(d.accountId, PrivateKey.fromString(d.privateKey));
          }
        }
      } catch (e) {
        this.logger.warn(`Invalid DEDICATED_WALLETS_JSON: ${e}`);
      }
    }
  }

  private registerIfPresent(
    key: KnownSignerKey,
    accountEnv: string,
    pkEnv: string,
  ) {
    const account = this.config.get<string>(accountEnv);
    const pk = this.config.get<string>(pkEnv);
    if (!account || !pk) {
      this.logger.warn(`Signer ${key} not configured (${accountEnv}/${pkEnv})`);
      return;
    }
    try {
      const privateKey = PrivateKey.fromString(pk);
      this.signers.set(key, {
        accountId: AccountId.fromString(account),
        privateKey,
      });
    } catch (e) {
      this.logger.error(`Failed to load signer ${key}: ${e}`);
    }
  }

  getSigner(walletKey: string): SignerCredentials {
    const known = this.signers.get(walletKey);
    if (known) return known;
    const pk = this.dedicatedKeys.get(walletKey);
    if (pk) {
      return {
        accountId: AccountId.fromString(walletKey),
        privateKey: pk,
      };
    }
    throw new Error(`Unknown signer wallet key: ${walletKey}`);
  }

  hasSigner(walletKey: string): boolean {
    return (
      this.signers.has(walletKey) || this.dedicatedKeys.has(walletKey)
    );
  }
}
