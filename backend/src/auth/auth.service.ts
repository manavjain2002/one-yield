import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PublicKey } from '@hashgraph/sdk';
import { verifyMessage } from 'ethers';
import { UserEntity } from '../entities/user.entity';
import { randomBytes } from 'crypto';

interface ChallengeEntry {
  message: string;
  expires: number;
}

@Injectable()
export class AuthService {
  private readonly challenges = new Map<string, ChallengeEntry>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {
    setInterval(() => this.pruneChallenges(), 60_000);
  }

  private pruneChallenges() {
    const now = Date.now();
    for (const [id, c] of this.challenges) {
      if (c.expires < now) this.challenges.delete(id);
    }
  }

  createChallenge(accountId: string) {
    const challengeId = randomBytes(16).toString('hex');
    const message = `OneYield auth: ${challengeId} for ${accountId} at ${Date.now()}`;
    this.challenges.set(challengeId, {
      message,
      expires: Date.now() + 5 * 60_000,
    });
    return { challengeId, message };
  }

  private isEvmAddress(accountId: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(accountId.trim());
  }

  private mirrorBaseUrl(): string {
    return (
      this.config.get<string>('hedera.mirrorNodeUrl') ??
      'https://testnet.mirrornode.hedera.com'
    );
  }

  /** Raw mirror account JSON (by 0.0.x, alias, or 0x EVM address). */
  private async fetchMirrorAccountJson(idOrEvm: string): Promise<{
    account?: string;
    key?: { key?: string };
    evm_address?: string;
  }> {
    const url = `${this.mirrorBaseUrl()}/api/v1/accounts/${encodeURIComponent(idOrEvm)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new UnauthorizedException('Account not found on mirror');
    }
    return (await res.json()) as {
      account?: string;
      key?: { key?: string };
      evm_address?: string;
    };
  }

  /**
   * Optional: map EVM → Hedera `0.0.x` when mirror has the account.
   * MetaMask users can use the app without this.
   */
  private async tryResolveEvmToHederaAccountId(
    evmAddress: string,
  ): Promise<string | null> {
    try {
      const data = await this.fetchMirrorAccountJson(evmAddress.trim());
      const hederaAccountId = data.account;
      if (!hederaAccountId) return null;
      if (data.evm_address) {
        const a = data.evm_address.replace(/^0x/i, '').toLowerCase();
        const b = evmAddress.replace(/^0x/i, '').toLowerCase();
        if (a !== b) return null;
      }
      return hederaAccountId;
    } catch {
      return null;
    }
  }

  /** Native Hedera wallets: require mirror `key` for signature verification. */
  private async mirrorAccountWithPublicKey(idOrAlias: string): Promise<{
    hederaAccountId: string;
    keyString: string;
  }> {
    const data = await this.fetchMirrorAccountJson(idOrAlias);
    const hederaAccountId = data.account;
    const k = data.key?.key;
    if (!hederaAccountId) {
      throw new UnauthorizedException('Account not found on mirror');
    }
    if (!k) throw new UnauthorizedException('No public key on account');
    return { hederaAccountId, keyString: k };
  }

  private async fetchMirrorPublicKey(accountId: string): Promise<PublicKey> {
    const { keyString } = await this.mirrorAccountWithPublicKey(accountId);
    return PublicKey.fromString(keyString);
  }

  private async findUserByWalletRef(walletRef: string): Promise<UserEntity | null> {
    const w = walletRef.trim();
    if (this.isEvmAddress(w)) {
      return this.users.findOne({
        where: { evmAddress: w.toLowerCase() },
      });
    }
    return this.users.findOne({ where: { hederaAccountId: w } });
  }

  /** Primary wallet string for JWT / on-chain borrower id (prefer EVM when present). */
  private walletAccountIdForJwt(user: UserEntity): string {
    const id = user.evmAddress ?? user.hederaAccountId;
    if (!id) {
      throw new Error('User has no wallet identifiers');
    }
    return id;
  }

  async verifyAndLogin(params: {
    accountId: string;
    challengeId: string;
    signatureHex: string;
  }) {
    const entry = this.challenges.get(params.challengeId);
    if (!entry || entry.expires < Date.now()) {
      throw new UnauthorizedException('Invalid or expired challenge');
    }
    this.challenges.delete(params.challengeId);

    if (this.isEvmAddress(params.accountId)) {
      const sigHex = params.signatureHex.trim().replace(/^0x/i, '');
      let recovered: string;
      try {
        recovered = verifyMessage(entry.message, `0x${sigHex}`);
      } catch {
        throw new UnauthorizedException('Invalid signature');
      }
      if (recovered.toLowerCase() !== params.accountId.toLowerCase()) {
        throw new UnauthorizedException('Invalid signature');
      }

      const evm = params.accountId.toLowerCase();
      const mirrorHedera = await this.tryResolveEvmToHederaAccountId(
        params.accountId,
      );

      let user = await this.users.findOne({ where: { evmAddress: evm } });
      if (!user && mirrorHedera) {
        user = await this.users.findOne({
          where: { hederaAccountId: mirrorHedera },
        });
        if (user && !user.evmAddress) {
          user.evmAddress = evm;
          await this.users.save(user);
        }
      }

      if (!user) {
        user = this.users.create({
          evmAddress: evm,
          hederaAccountId: mirrorHedera,
          role: 'lender',
        });
        await this.users.save(user);
      } else if (mirrorHedera && !user.hederaAccountId) {
        user.hederaAccountId = mirrorHedera;
        await this.users.save(user);
      }

      const walletAccountId = this.walletAccountIdForJwt(user);
      const accessToken = await this.jwt.signAsync({
        sub: user.id,
        accountId: walletAccountId,
        role: user.role,
      });

      return {
        accessToken,
        role: user.role,
        accountId: walletAccountId,
      };
    }

    const pub = await this.fetchMirrorPublicKey(params.accountId);
    const message = Buffer.from(entry.message, 'utf8');
    const sig = Buffer.from(params.signatureHex.replace(/^0x/i, ''), 'hex');
    const ok = pub.verify(message, sig);
    if (!ok) {
      throw new UnauthorizedException('Invalid signature');
    }

    const canonicalAccountId = params.accountId;
    let user = await this.users.findOne({
      where: { hederaAccountId: canonicalAccountId },
    });
    if (!user) {
      user = this.users.create({
        hederaAccountId: canonicalAccountId,
        evmAddress: null,
        role: 'lender',
      });
      await this.users.save(user);
    }

    const walletAccountId = this.walletAccountIdForJwt(user);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      accountId: walletAccountId,
      role: user.role,
    });

    return {
      accessToken,
      role: user.role,
      accountId: walletAccountId,
    };
  }

  async setRole(walletRef: string, role: UserEntity['role']) {
    const user = await this.findUserByWalletRef(walletRef);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.role = role;
    await this.users.save(user);
    return user;
  }
}
