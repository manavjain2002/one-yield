import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoolEntity } from '../entities/pool.entity';
import { ContractEncodeService } from '../blockchain/contract-encode.service';
import { QueueService } from '../queue/queue.service';
import { SignerService } from '../blockchain/signer.service';

/**
 * Daily oracle AUM nudge (max +0.08% per contract rules) during maintenance window.
 * Configure pool pauseStartTime / pauseDuration in DB to align with cron (default mirror UTC).
 */
@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);
  private consecutiveFailures = 0;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(PoolEntity)
    private readonly pools: Repository<PoolEntity>,
    private readonly encode: ContractEncodeService,
    private readonly queue: QueueService,
    private readonly signers: SignerService,
  ) {}

  /** 00:30 UTC ≈ 6:00 AM IST; override via Schedule dynamic registration if needed */
  @Cron('30 0 * * *')
  async scheduledAumUpdate() {
    await this.runAumUpdates();
  }

  /** Every 5 minutes: refresh derived lender position values from DB (simplified). */
  @Cron('*/5 * * * *')
  async refreshPositionSnapshots() {
    /* Positions updated on-chain via indexer; optional off-chain recompute could go here */
  }

  async runAumUpdates() {
    if (!this.signers.hasSigner('oracle')) {
      this.logger.warn('Oracle signer not configured; skipping AUM cron');
      return;
    }
    const list = await this.pools.find({ where: { status: 'active' } });
    const nowSec = Math.floor(Date.now() / 1000);
    const sod = nowSec % 86400;
    for (const pool of list) {
      try {
        const start = Number(pool.pauseStartTime ?? 0);
        const dur = Number(pool.pauseDuration ?? 1800);
        const inWindow = sod >= start && sod <= start + dur;
        if (!inWindow) {
          this.logger.debug(
            `Skip ${pool.contractAddress}: outside maintenance window`,
          );
          continue;
        }
        const current = BigInt(pool.assetUnderManagement || '0');
        if (current === 0n) continue;
        const newAum = (current * 10008n) / 10000n;
        if (newAum <= current) continue;
        const encoded = this.encode.encodeUpdateAssetUnderManagement(newAum);
        await this.queue.addContractCall({
          walletKey: 'oracle',
          contractId: pool.contractAddress,
          functionName: 'updateAssetUnderManagement',
          payloadHex: Buffer.from(encoded).toString('hex'),
          poolAddress: pool.contractAddress,
        });
        this.consecutiveFailures = 0;
      } catch (e) {
        this.logger.error(`AUM update failed for ${pool.contractAddress}: ${e}`);
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.logger.error(
            'Circuit breaker: 3+ oracle failures — investigate pools / signers',
          );
        }
      }
    }
  }
}
