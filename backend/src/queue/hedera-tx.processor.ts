import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HederaExecuteService } from '../blockchain/hedera-execute.service';
import { EventsGateway } from '../websocket/events.gateway';
import { QueueJobEntity } from '../entities/queue-job.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { HEDERA_TX_QUEUE, HederaTxJobPayload } from './tx-queue.constants';
import { WalletSequenceService } from './wallet-sequence.service';

@Processor(HEDERA_TX_QUEUE, { concurrency: 8 })
export class HederaTxProcessor extends WorkerHost {
  private readonly logger = new Logger(HederaTxProcessor.name);

  constructor(
    private readonly hedera: HederaExecuteService,
    private readonly sequence: WalletSequenceService,
    private readonly events: EventsGateway,
    @InjectRepository(QueueJobEntity)
    private readonly queueJobRepo: Repository<QueueJobEntity>,
    @InjectRepository(PoolDraftEntity)
    private readonly draftRepo: Repository<PoolDraftEntity>,
  ) {
    super();
  }

  async process(job: Job<HederaTxJobPayload>): Promise<unknown> {
    const { walletKey, contractId, functionName, payloadHex, poolAddress } =
      job.data;
      console.log('job.data', job.data);
      console.log('walletKey', walletKey);
      console.log('contractId', contractId);
      console.log('functionName', functionName);
      console.log('payloadHex', payloadHex);
      console.log('poolAddress', poolAddress);
    const jobEntity = await this.queueJobRepo.findOne({
      where: { jobId: job.id ?? '' },
    });
    if (jobEntity) {
      jobEntity.status = 'processing';
      await this.queueJobRepo.save(jobEntity);
    }

    try {
      const bytes = Buffer.from(payloadHex.replace(/^0x/, ''), 'hex');
      const result = await this.sequence.run(walletKey, () =>
        this.hedera.executeContract({
          walletKey,
          contractId,
          functionParameters: new Uint8Array(bytes),
        }),
      );

      if (jobEntity) {
        jobEntity.status = 'done';
        jobEntity.txHash = result.txHash;
        jobEntity.processedAt = new Date();
        await this.queueJobRepo.save(jobEntity);
      }

      if (job.data.draftId) {
        await this.draftRepo.update(
          { id: job.data.draftId },
          { hederaTransactionId: result.transactionId },
        );
      }

      this.events.emitTxUpdate({
        jobId: job.id,
        status: 'confirmed',
        txHash: result.txHash,
        poolAddress,
        functionName,
      });

      return result;
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
        poolAddress,
        functionName,
      });
      throw err;
    }
  }
}
