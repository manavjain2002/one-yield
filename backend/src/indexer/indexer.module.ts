import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsModule } from '../contracts/contracts.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { PoolEntity } from '../entities/pool.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { ContractRegistryEntity } from '../entities/contract-registry.entity';
import { IndexerStateEntity } from '../entities/indexer-state.entity';
import { TransactionRecordEntity } from '../entities/transaction-record.entity';
import { LenderPositionEntity } from '../entities/lender-position.entity';
import { AumHistoryEntity } from '../entities/aum-history.entity';
import { BorrowerPoolEntity } from '../entities/borrower-pool.entity';
import { IndexerService } from './indexer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PoolEntity,
      PoolDraftEntity,
      ContractRegistryEntity,
      IndexerStateEntity,
      TransactionRecordEntity,
      LenderPositionEntity,
      AumHistoryEntity,
      BorrowerPoolEntity,
    ]),
    ContractsModule,
    WebsocketModule,
  ],
  providers: [IndexerService],
  exports: [IndexerService],
})
export class IndexerModule {}
