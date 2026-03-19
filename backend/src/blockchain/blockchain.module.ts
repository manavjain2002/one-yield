import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContractEncodeService } from './contract-encode.service';
import { HederaExecuteService } from './hedera-execute.service';
import { SignerService } from './signer.service';

@Module({
  imports: [ConfigModule],
  providers: [
    SignerService,
    ContractEncodeService,
    HederaExecuteService,
  ],
  exports: [SignerService, ContractEncodeService, HederaExecuteService],
})
export class BlockchainModule {}
