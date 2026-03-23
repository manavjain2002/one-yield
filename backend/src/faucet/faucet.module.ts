import { Module } from '@nestjs/common';
import { ContractsModule } from '../contracts/contracts.module';
import { FaucetController } from './faucet.controller';
import { FaucetService } from './faucet.service';

@Module({
  imports: [ContractsModule],
  controllers: [FaucetController],
  providers: [FaucetService],
})
export class FaucetModule {}
