import { Global, Module } from '@nestjs/common';
import { ChainalysisService } from './chainalysis.service';

@Global()
@Module({
  providers: [ChainalysisService],
  exports: [ChainalysisService],
})
export class ScreeningModule {}
