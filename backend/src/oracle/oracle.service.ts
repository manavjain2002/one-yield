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

  /**
   * Enqueues oracle `updateAssetUnderManagement` jobs for active pools (+0.08% nudge).
   * Used by cron and by POST /admin/oracle/run-aum-update (admin JWT).
   */
  async runAumUpdates(): Promise<{
    oracleSignerConfigured: boolean;
    activePoolCount: number;
    jobsEnqueued: number;
    skippedZeroAum: number;
    skippedNoIncrease: number;
    failures: { poolId: string; contractAddress: string; error: string }[];
  }> {
    const summary = {
      oracleSignerConfigured: this.contracts.hasSigner('oracle'),
      activePoolCount: 0,
      jobsEnqueued: 0,
      skippedZeroAum: 0,
      skippedNoIncrease: 0,
      failures: [] as { poolId: string; contractAddress: string; error: string }[],
    };

    if (!summary.oracleSignerConfigured) {
      this.logger.warn('Oracle signer not configured; skipping AUM update (set ORACLE_PRIVATE_KEY)');
      return summary;
    }

    const activePools = await this.pools.find({ where: { status: 'active' } });
    summary.activePoolCount = activePools.length;

    for (const pool of activePools) {
      try {
        const current = BigInt(pool.assetUnderManagement || '0');
        if (current === 0n) {
          summary.skippedZeroAum++;
          continue;
        }

        // +0.08% daily nudge
        const newAum = (current * 10008n) / 10000n;
        if (newAum <= current) {
          summary.skippedNoIncrease++;
          continue;
        }

        await this.queue.addContractCall({
          signerKey: 'oracle',
          contractAddress: pool.contractAddress,
          abi: 'pool',
          functionName: 'updateAssetUnderManagement',
          args: [newAum.toString()],
          meta: { poolId: pool.id },
        });

        summary.jobsEnqueued++;
        this.consecutiveFailures = 0;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(
          `AUM update failed for ${pool.contractAddress}: ${e}`,
        );
        summary.failures.push({
          poolId: pool.id,
          contractAddress: pool.contractAddress,
          error: msg,
        });
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 3) {
          this.logger.error(
            'Circuit breaker: 3+ oracle failures — investigate',
          );
        }
      }
    }

    return summary;
  }
}
