import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PoolEntity } from '../entities/pool.entity';
import { ContractService } from '../contracts/contract.service';
import { QueueService } from '../queue/queue.service';

/**
 * Daily oracle AUM update (max +0.08% per contract rules).
 * Runs at 00:30 UTC ≈ 6:00 AM IST.
 */
@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);
  private consecutiveFailures = 0;

  constructor(
    @InjectRepository(PoolEntity)
    private readonly pools: Repository<PoolEntity>,
    private readonly contracts: ContractService,
    private readonly queue: QueueService,
  ) {}

  @Cron('30 0 * * *')
  async scheduledAumUpdate() {
    await this.runAumUpdates();
  }

  async runAumUpdates() {
    if (!this.contracts.hasSigner('oracle')) {
      this.logger.warn('Oracle signer not configured; skipping AUM cron');
      return;
    }

    const activePools = await this.pools.find({ where: { status: 'active' } });

    for (const pool of activePools) {
      try {
        const current = BigInt(pool.assetUnderManagement || '0');
        if (current === 0n) continue;

        // +0.08% daily nudge
        const newAum = (current * 10008n) / 10000n;
        if (newAum <= current) continue;

        await this.queue.addContractCall({
          signerKey: 'oracle',
          contractAddress: pool.contractAddress,
          abi: 'pool',
          functionName: 'updateAssetUnderManagement',
          args: [newAum.toString()],
          meta: { poolId: pool.id },
        });

        this.consecutiveFailures = 0;
      } catch (e) {
        this.logger.error(
          `AUM update failed for ${pool.contractAddress}: ${e}`,
        );
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.logger.error(
            'Circuit breaker: 3+ oracle failures — investigate',
          );
        }
      }
    }
  }
}
