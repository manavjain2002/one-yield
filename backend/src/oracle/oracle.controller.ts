import { Controller, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OracleService } from './oracle.service';

/**
 * Manual AUM update trigger (same logic as the daily cron).
 * Call from Postman: POST /admin/oracle/run-aum-update with Authorization: Bearer <admin JWT>.
 * Oracle txs use ORACLE_PRIVATE_KEY from env (loaded in ContractService).
 */
@Controller('admin/oracle')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@SkipThrottle()
export class OracleController {
  constructor(private readonly oracle: OracleService) {}

  @Post('run-aum-update')
  async runAumUpdate() {
    return this.oracle.runAumUpdates();
  }
}
