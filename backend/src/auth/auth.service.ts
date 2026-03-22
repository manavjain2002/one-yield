import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { verifyMessage } from 'ethers';
import { UserEntity } from '../entities/user.entity';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { OnModuleInit } from '@nestjs/common';

interface ChallengeEntry {
  message: string;
  expires: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly challenges = new Map<string, ChallengeEntry>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {
    setInterval(() => this.pruneChallenges(), 60_000);
  }

  async onModuleInit() {
    const adminUsername = 'oyAdmin';
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD') || 'oy-admin-password-456';
    
    let admin = await this.users.findOne({ where: { username: adminUsername } });
    if (!admin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      admin = this.users.create({
        username: adminUsername,
        passwordHash,
        role: 'admin',
      });
      await this.users.save(admin);
    } else if (admin.role !== 'admin') {
      admin.role = 'admin';
      await this.users.save(admin);
    }
  }

  private pruneChallenges() {
    const now = Date.now();
    for (const [id, c] of this.challenges) {
      if (c.expires < now) this.challenges.delete(id);
    }
  }

  /** Normalize credential usernames for storage and lookup. */
  normalizeUsername(raw: string): string {
    return raw.trim().toLowerCase();
  }

  async checkUsernameAvailable(raw: string): Promise<{ available: boolean }> {
    const username = this.normalizeUsername(raw);
    if (username.length < 3) {
      return { available: false };
    }
    const existing = await this.users.findOne({ where: { username } });
    return { available: !existing };
  }

  createChallenge(walletAddress: string) {
    const challengeId = randomBytes(16).toString('hex');
    const message = `OneYield auth: ${challengeId} for ${walletAddress} at ${Date.now()}`;
    this.challenges.set(challengeId, {
      message,
      expires: Date.now() + 5 * 60_000,
    });
    return { challengeId, message };
  }

  private isEvmAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
  }

  async verifyAndLogin(params: {
    walletAddress: string;
    challengeId: string;
    signatureHex: string;
  }) {
    const entry = this.challenges.get(params.challengeId);
    if (!entry || entry.expires < Date.now()) {
      throw new UnauthorizedException('Invalid or expired challenge');
    }
    this.challenges.delete(params.challengeId);

    if (!this.isEvmAddress(params.walletAddress)) {
      throw new UnauthorizedException('Only EVM addresses are supported');
    }

    const sigHex = params.signatureHex.trim().replace(/^0x/i, '');
    let recovered: string;
    try {
      recovered = verifyMessage(entry.message, `0x${sigHex}`);
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }
    if (recovered.toLowerCase() !== params.walletAddress.toLowerCase()) {
      throw new UnauthorizedException('Invalid signature');
    }

    const evm = params.walletAddress.toLowerCase();

    let user = await this.users.findOne({ where: { walletAddress: evm } });

    if (!user) {
      user = this.users.create({
        walletAddress: evm,
        role: 'lender',
      });
      await this.users.save(user);
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return {
      accessToken,
      role: user.role,
      walletAddress: user.walletAddress,
    };
  }

  async setRole(userId: string, role: UserEntity['role']) {
    const user = await this.users.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    user.role = role;
    await this.users.save(user);

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      role: user.role,
    });



    return {
      accessToken,
      role: user.role,
      walletAddress: user.walletAddress,
    };
  }

  async registerWithCredentials(params: {
    username: string;
    passwordPlain: string;
    role: UserEntity['role'];
    displayName: string;
    email: string;
    country: string;
  }) {
    const username = this.normalizeUsername(params.username);
    if (username.length < 3) {
      throw new BadRequestException('Invalid username');
    }
    const existing = await this.users.findOne({ where: { username } });
    if (existing) {
      throw new UnauthorizedException('Username already taken');
    }
    const passwordHash = await bcrypt.hash(params.passwordPlain, 10);
    const user = this.users.create({
      username,
      passwordHash,
      role: params.role,
      displayName: params.displayName.trim(),
      email: params.email.trim().toLowerCase(),
      country: params.country.trim(),
    });
    await this.users.save(user);

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return {
      accessToken,
      role: user.role,
      username: user.username,
    };
  }

  async refreshToken(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      walletAddress: user.walletAddress,
      username: user.username,
      role: user.role,
    });
    return { accessToken, role: user.role };
  }

  async loginWithCredentials(username: string, passwordPlain: string) {
    const normalized = this.normalizeUsername(username);
    const user = await this.users.findOne({ where: { username: normalized } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
      role: user.role,
    });

    return {
      accessToken,
      role: user.role,
      username: user.username,
    };
  }
}
