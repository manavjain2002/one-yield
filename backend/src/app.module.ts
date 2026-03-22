import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { WebsocketModule } from './websocket/websocket.module';
import { ScreeningModule } from './screening/screening.module';
import { ContractsModule } from './contracts/contracts.module';
import { QueueModule } from './queue/queue.module';
import { OracleModule } from './oracle/oracle.module';
import { AuthModule } from './auth/auth.module';
import { PoolsModule } from './pools/pools.module';
import { HealthController } from './health.controller';
import { PoolEntity } from './entities/pool.entity';
import { PoolDraftEntity } from './entities/pool-draft.entity';
import { BorrowerPoolEntity } from './entities/borrower-pool.entity';
import { TransactionRecordEntity } from './entities/transaction-record.entity';
import { LenderPositionEntity } from './entities/lender-position.entity';
import { AumHistoryEntity } from './entities/aum-history.entity';
import { QueueJobEntity } from './entities/queue-job.entity';
import { ContractRegistryEntity } from './entities/contract-registry.entity';
import { UserEntity } from './entities/user.entity';
import { BorrowerWalletEntity } from './entities/borrower-wallet.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [
          PoolEntity,
          PoolDraftEntity,
          BorrowerPoolEntity,
          TransactionRecordEntity,
          LenderPositionEntity,
          AumHistoryEntity,
          QueueJobEntity,
          ContractRegistryEntity,
          UserEntity,
          BorrowerWalletEntity,
        ],
        synchronize: config.get<string>('nodeEnv') !== 'production',
        logging: config.get<string>('nodeEnv') === 'development',
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          username: config.get<string>('redis.username'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    WebsocketModule,
    ScreeningModule,
    ContractsModule,
    QueueModule,
    OracleModule,
    AuthModule,
    PoolsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
