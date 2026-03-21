import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueJobEntity } from '../entities/queue-job.entity';
import { TX_QUEUE, TxJobPayload } from './tx-queue.constants';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(TX_QUEUE) private readonly txQueue: Queue,
    @InjectRepository(QueueJobEntity)
    private readonly queueJobRepo: Repository<QueueJobEntity>,
  ) {}

  async addContractCall(
    payload: TxJobPayload,
    opts?: { priority?: number },
  ) {
    const job = await this.txQueue.add('execute', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      priority: opts?.priority,
    });

    await this.queueJobRepo.save({
      jobId: String(job.id),
      walletKey: payload.signerKey,
      contractAddress: payload.contractAddress,
      functionName: payload.functionName,
      status: 'pending',
      retryCount: 0,
    });

    return { jobId: String(job.id) };
  }
}
