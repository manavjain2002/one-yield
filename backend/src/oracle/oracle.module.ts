import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PoolEntity } from '../entities/pool.entity';
import { ContractsModule } from '../contracts/contracts.module';
import { QueueModule } from '../queue/queue.module';
import { AuthModule } from '../auth/auth.module';
import { OracleService } from './oracle.service';
import { OracleController } from './oracle.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PoolEntity]),
    ContractsModule,
    QueueModule,
    AuthModule,
  ],
  controllers: [OracleController],
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
