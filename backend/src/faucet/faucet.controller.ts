import { Body, Controller, Get, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { FaucetService } from './faucet.service';
import { FaucetClaimDto } from './dto/faucet-claim.dto';

/** Stricter than global default; public faucet is abuse-prone. */
const FAUCET_CLAIM_THROTTLE = { default: { limit: 5, ttl: 60_000 } } as const;

@Controller('faucet')
export class FaucetController {
  constructor(private readonly faucet: FaucetService) {}

  @Get('info')
  @SkipThrottle()
  info() {
    return this.faucet.getInfo();
  }

  @Post('claim')
  @Throttle(FAUCET_CLAIM_THROTTLE)
  claim(@Body() body: FaucetClaimDto) {
    return this.faucet.claim(body);
  }
}
