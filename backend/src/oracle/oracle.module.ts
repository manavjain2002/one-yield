import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoolEntity } from '../entities/pool.entity';
import { ContractsModule } from '../contracts/contracts.module';
import { QueueModule } from '../queue/queue.module';
import { OracleService } from './oracle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PoolEntity]),
    ContractsModule,
    QueueModule,
  ],
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
