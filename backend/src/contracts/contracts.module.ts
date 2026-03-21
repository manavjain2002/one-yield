import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContractService } from './contract.service';

@Module({
  imports: [ConfigModule],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractsModule {}
