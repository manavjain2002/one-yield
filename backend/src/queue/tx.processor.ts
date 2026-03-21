import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractService } from '../contracts/contract.service';
import { EventsGateway } from '../websocket/events.gateway';
import { QueueJobEntity } from '../entities/queue-job.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { TX_QUEUE, TxJobPayload } from './tx-queue.constants';
import {
  POOL_FACTORY_ABI,
  LENDING_POOL_ABI,
  ASSET_MANAGER_ABI,
} from '../contracts/abis';

const ABI_MAP = {
  factory: POOL_FACTORY_ABI,
  pool: LENDING_POOL_ABI,
  fund_manager: ASSET_MANAGER_ABI,
} as const;

/**
 * Processes queued blockchain transactions one at a time
 * to avoid nonce conflicts from the same signer.
 */
@Processor(TX_QUEUE, { concurrency: 1 })
export class TxProcessor extends WorkerHost {
  private readonly logger = new Logger(TxProcessor.name);

  constructor(
    private readonly contracts: ContractService,
    private readonly events: EventsGateway,
    @InjectRepository(QueueJobEntity)
    private readonly queueJobRepo: Repository<QueueJobEntity>,
    @InjectRepository(PoolDraftEntity)
    private readonly draftRepo: Repository<PoolDraftEntity>,
  ) {
    super();
  }

  async process(job: Job<TxJobPayload>): Promise<unknown> {
    const {
      signerKey,
      contractAddress,
      abi,
      functionName,
      args,
      meta,
    } = job.data;

    // Mark job as processing
    const jobEntity = await this.queueJobRepo.findOne({
      where: { jobId: job.id ?? '' },
    });
    if (jobEntity) {
      jobEntity.status = 'processing';
      await this.queueJobRepo.save(jobEntity);
    }

    try {
      // Build contract and send tx
      const abiArray = ABI_MAP[abi];
      const contract = this.contracts.get(
        contractAddress,
        abiArray,
        signerKey,
      );
      const tx = await contract[functionName](...args);
      const receipt = await tx.wait();

      const txHash: string = tx.hash;
      const status = receipt?.status === 1 ? 'confirmed' : 'failed';

      // Update job record
      if (jobEntity) {
        jobEntity.status = 'done';
        jobEntity.txHash = txHash;
        jobEntity.processedAt = new Date();
        await this.queueJobRepo.save(jobEntity);
      }

      // Link draft if this was a createPool tx
      if (meta?.draftId) {
        await this.draftRepo.update(
          { id: meta.draftId },
          { txHash },
        );
      }

      // Notify frontend via WebSocket
      this.events.emitTxUpdate({
        jobId: job.id,
        status,
        txHash,
        poolAddress: meta?.poolId,
        functionName,
      });

      return { txHash, status };
    } catch (err) {
      this.logger.error(`Job ${job.id} failed: ${err}`);
      if (jobEntity) {
        jobEntity.status = 'failed';
        jobEntity.retryCount = job.attemptsMade;
        jobEntity.lastError = String(err);
        await this.queueJobRepo.save(jobEntity);
      }
      this.events.emitTxUpdate({
        jobId: job.id,
        status: 'failed',
        error: String(err),
        poolAddress: meta?.poolId,
        functionName,
      });
      throw err;
    }
  }
}
