import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sanctions / risk screening. Stub returns allowed when CHAINALYSIS_API_KEY is unset.
 * Wire real Chainalysis API in production.
 */
@Injectable()
export class ChainalysisService {
  private readonly logger = new Logger(ChainalysisService.name);

  constructor(private readonly config: ConfigService) {}

  async assertAddressAllowed(address: string): Promise<void> {
    const key = this.config.get<string>('chainalysis.apiKey');
    if (!key) {
      this.logger.debug(`Screening skipped (no API key): ${address}`);
      return;
    }
    // TODO: POST Chainalysis register / withdraw attempt endpoints
    this.logger.warn('Chainalysis API key set but integration not implemented');
  }
}
