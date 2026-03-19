import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueJobEntity } from '../entities/queue-job.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { HEDERA_TX_QUEUE } from './tx-queue.constants';
import { HederaTxProcessor } from './hedera-tx.processor';
import { QueueService } from './queue.service';
import { WalletSequenceService } from './wallet-sequence.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: HEDERA_TX_QUEUE }),
    TypeOrmModule.forFeature([QueueJobEntity, PoolDraftEntity]),
    BlockchainModule,
    WebsocketModule,
  ],
  providers: [HederaTxProcessor, QueueService, WalletSequenceService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
