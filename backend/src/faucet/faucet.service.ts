import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { ContractService } from '../contracts/contract.service';
import { ERC20_ABI } from '../contracts/abis';
import type { FaucetClaimDto } from './dto/faucet-claim.dto';

export type FaucetInfoResponse = {
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  /** POST /faucet/claim is available. */
  claimEnabled: boolean;
  /** Human-readable max per claim (same units as form amount). */
  maxPerTxHuman: string;
};

@Injectable()
export class FaucetService {
  private readonly logger = new Logger(FaucetService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly contracts: ContractService,
  ) {}

  private tokenAddress(): string {
    const override = this.config.get<string>('faucet.tokenAddress')?.trim();
    const fallback = this.config.get<string>('blockchain.poolTokenAddress')?.trim();
    const addr = override || fallback;
    if (!addr) {
      throw new BadRequestException('Token address not configured');
    }
    return ethers.getAddress(addr);
  }

  private faucetPrivateKey(): string | undefined {
    return this.config.get<string>('faucet.privateKey');
  }

  async getInfo(): Promise<FaucetInfoResponse> {
    const tokenAddress = this.tokenAddress();
    const read = this.contracts.erc20(tokenAddress);
    let nameStr: string;
    try {
      nameStr = await read.name();
    } catch {
      nameStr = '';
    }
    const [symbol, decimals] = await Promise.all([
      read.symbol(),
      read.decimals(),
    ]);
    const maxPerTxHuman =
      this.config.get<string>('faucet.maxPerTxHuman')?.trim() || '100';
    return {
      tokenAddress,
      name: nameStr || symbol,
      symbol,
      decimals: Number(decimals),
      claimEnabled: Boolean(this.faucetPrivateKey()),
      maxPerTxHuman,
    };
  }

  async claim(dto: FaucetClaimDto): Promise<{ txHash: string }> {
    const pk = this.faucetPrivateKey();
    if (!pk) {
      throw new ServiceUnavailableException(
        'Faucet is not configured (missing FAUCET_PRIVATE_KEY)',
      );
    }

    const tokenAddress = this.tokenAddress();
    const read = this.contracts.erc20(tokenAddress);
    const [decimalsRaw, symbol] = await Promise.all([
      read.decimals(),
      read.symbol(),
    ]);
    const decimals = Number(decimalsRaw);
    const maxHuman =
      this.config.get<string>('faucet.maxPerTxHuman')?.trim() || '100';

    let value: bigint;
    let maxValue: bigint;
    try {
      value = ethers.parseUnits(dto.amount.trim(), decimals);
      maxValue = ethers.parseUnits(maxHuman, decimals);
    } catch {
      throw new BadRequestException('Invalid amount for token decimals');
    }

    if (value <= 0n) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    if (value > maxValue) {
      throw new BadRequestException(
        `Amount exceeds maximum per claim (${maxHuman} ${symbol})`,
      );
    }

    const recipient = ethers.getAddress(dto.recipient);
    const provider = this.contracts.getProvider();
    let wallet: ethers.Wallet;
    try {
      wallet = new ethers.Wallet(pk, provider);
    } catch {
      this.logger.warn('Invalid FAUCET_PRIVATE_KEY');
      throw new ServiceUnavailableException('Faucet signer misconfigured');
    }

    const token = new ethers.Contract(tokenAddress, [...ERC20_ABI], wallet);
    const balance: bigint = await token.balanceOf(wallet.address);
    if (balance < value) {
      throw new BadRequestException(
        'Faucet wallet does not have enough token balance for this transfer',
      );
    }

    const tx = await token.transfer(recipient, value);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new BadRequestException('Token transfer failed on-chain');
    }
    return { txHash: receipt.hash };
  }
}
