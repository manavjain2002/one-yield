import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueJobEntity } from '../entities/queue-job.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { ContractsModule } from '../contracts/contracts.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { TX_QUEUE } from './tx-queue.constants';
import { TxProcessor } from './tx.processor';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: TX_QUEUE }),
    TypeOrmModule.forFeature([QueueJobEntity, PoolDraftEntity]),
    ContractsModule,
    WebsocketModule,
  ],
  providers: [TxProcessor, QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
