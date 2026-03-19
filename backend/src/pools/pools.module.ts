import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoolEntity } from '../entities/pool.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { BorrowerPoolEntity } from '../entities/borrower-pool.entity';
import { TransactionRecordEntity } from '../entities/transaction-record.entity';
import { LenderPositionEntity } from '../entities/lender-position.entity';
import { QueueJobEntity } from '../entities/queue-job.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';
import { PoolsService } from './pools.service';
import {
  BorrowerRoutesController,
  LenderRoutesController,
  ManagerRoutesController,
  PoolsController,
} from './pools.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      PoolEntity,
      PoolDraftEntity,
      BorrowerPoolEntity,
      TransactionRecordEntity,
      LenderPositionEntity,
      QueueJobEntity,
    ]),
    BlockchainModule,
    QueueModule,
    AuthModule,
  ],
  controllers: [
    PoolsController,
    BorrowerRoutesController,
    LenderRoutesController,
    ManagerRoutesController,
  ],
  providers: [PoolsService],
  exports: [PoolsService],
})
export class PoolsModule {}
