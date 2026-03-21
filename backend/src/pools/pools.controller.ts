import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { Type } from 'class-transformer';
import { PoolsService } from './pools.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { PoolEntity } from '../entities/pool.entity';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

// ─── Request DTOs ────────────────────────────────────────────

class CreatePoolBody {
  @IsString() @MinLength(1)
  name: string;

  @IsString() @MinLength(1)
  symbol: string;

  @IsOptional() 
  @Type(() => Number)
  @IsInt() @Min(0)
  apyBasisPoints?: number;

  @IsString()
  poolSize: string;

  @IsOptional()
  @IsString()
  poolTokenAddress?: string;
}

class ConfirmDraftBody {
  @IsString()
  txHash: string;
}

class AllocationItem {
  @IsString()
  v1PoolId: string;

  @IsInt() @Min(1) @Max(10000)
  allocationBps: number;

  @IsString()
  dedicatedWalletAddress: string;
}

class SetAllocationsBody {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationItem)
  allocations: AllocationItem[];
}

class RepayBody {
  @IsString() poolId: string;
  @IsString() v1PoolId: string;
  @IsString() amount: string;
  @IsString() fee: string;
}

class SendReserveBody {
  @IsString() amount: string;
  @IsString() uptoQueuePosition: string;
}

class RecordActivityBody {
  @IsString() txHash: string;
  @IsString() type: string;
  @IsString() amount: string;
  @IsOptional() @IsString() poolId?: string;
  @IsOptional() @IsString() tokenAddress?: string;
  @IsOptional() @IsString() toAddress?: string;
}

// ─── Pool CRUD + Actions ─────────────────────────────────────

@Controller('pools')
export class PoolsController {
  constructor(
    private readonly pools: PoolsService,
    private readonly config: ConfigService,
  ) {}

  private getRequiredAddress(
    field: 'poolManagerAddress' | 'oracleManagerAddress' | 'feeCollectorAddress',
    label: string,
  ): string {
    const value = this.config.get<string>(`blockchain.${field}`)?.trim();
    if (!value) throw new BadRequestException(`${label} must be provided via ENV`);
    return value;
  }

  @Get()
  @SkipThrottle()
  list(@Query('status') status?: PoolEntity['status']) {
    return this.pools.listPools(status);
  }

  @Get('constants/tokens')
  @SkipThrottle()
  getTokens() {
    return [
      {
        symbol: 'USDC',
        name: 'USD Coin',
        address: this.config.get<string>('blockchain.poolTokenAddress')?.trim(),
      },
      // You can add more supported tokens here as needed
    ].filter(t => !!t.address);
  }

  @Get(':id')
  @SkipThrottle()
  get(@Param('id') id: string) {
    return this.pools.getPool(id);
  }

  @Get(':id/transactions')
  @SkipThrottle()
  txs(@Param('id') id: string) {
    return this.pools.getTransactions(id);
  }

  @Get(':id/on-chain')
  @SkipThrottle()
  onChain(@Param('id') id: string) {
    return this.pools.getOnChainState(id);
  }

  /**
   * POST /pools — Creates a draft and returns encoded tx data.
   * The borrower sends the createPool tx from their MetaMask wallet.
   */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentUser() user: JwtUser, 
    @Body() body: CreatePoolBody,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const poolManagerAddress = this.getRequiredAddress('poolManagerAddress', 'POOL_MANAGER_ADDRESS');
    const oracleManagerAddress = this.getRequiredAddress('oracleManagerAddress', 'ORACLE_MANAGER_ADDRESS');
    const feeCollectorAddress = this.getRequiredAddress('feeCollectorAddress', 'FEE_COLLECTOR_ADDRESS');
    const poolTokenAddress = this.config.get<string>('blockchain.poolTokenAddress')?.trim();
    if (!poolTokenAddress) throw new BadRequestException('POOL_TOKEN_ADDRESS must be configured');

    // Trigger direct contract creation by the backend manager wallet
    const identifier = user.walletAddress || user.username || user.userId;
    return this.pools.createPoolDirect(identifier, {
      name: body.name,
      symbol: body.symbol,
      poolManagerAddress,
      poolTokenAddress: body.poolTokenAddress || poolTokenAddress,
      oracleManagerAddress,
      feeCollectorAddress,
      apyBasisPoints: body.apyBasisPoints ?? 500,
      poolSize: body.poolSize,
    }, file);
  }



  @Patch(':id/allocations')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  setAllocations(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: SetAllocationsBody,
  ) {
    const identifier = user.walletAddress || user.username || user.userId;
    return this.pools.setAllocations(id, body.allocations, identifier);
  }

  @Post(':id/activate')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  activate(@Param('id') id: string) {
    return this.pools.activatePool(id);
  }

  @Post(':id/pause')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  pause(@Param('id') id: string) {
    return this.pools.pausePool(id);
  }

  @Post(':id/unpause')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  unpause(@Param('id') id: string) {
    return this.pools.unpausePool(id);
  }

  @Post(':id/deploy-funds')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  deploy(@Param('id') id: string) {
    return this.pools.deployFunds(id);
  }

  @Post(':id/send-to-reserve')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  sendReserve(@Param('id') id: string, @Body() body: SendReserveBody) {
    return this.pools.sendToReserve(id, BigInt(body.amount), BigInt(body.uptoQueuePosition));
  }

  @Post('record-activity')
  @UseGuards(JwtAuthGuard)
  recordActivity(@CurrentUser() user: JwtUser, @Body() body: RecordActivityBody) {
    return this.pools.recordManualActivity(user.walletAddress, body);
  }
}

// ─── Borrower Routes ─────────────────────────────────────────

@Controller('borrower')
export class BorrowerRoutesController {
  constructor(private readonly pools: PoolsService) {}

  @Get('pools')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  myPools(@CurrentUser() user: JwtUser) {
    return this.pools.borrowerPoolsFor(user.walletAddress, user.username);
  }

  @Get('wallets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  getWallets(@CurrentUser() user: JwtUser) {
    return this.pools.getBorrowerWallets(user.username || user.walletAddress);
  }

  @Post('wallets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  setWallet(@CurrentUser() user: JwtUser, @Body() body: { tokenAddress: string; walletAddress: string }) {
    if (!body.tokenAddress || !body.walletAddress) {
      throw new BadRequestException('tokenAddress and walletAddress are required');
    }
    return this.pools.setBorrowerWallet(user.username || user.walletAddress, body.tokenAddress, body.walletAddress);
  }

  @Post('repay')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  repay(@CurrentUser() user: JwtUser, @Body() body: RepayBody) {
    const identifier = user.walletAddress || user.username || user.userId;
    return this.pools.repay(
      identifier,
      body.poolId,
      body.v1PoolId,
      BigInt(body.amount),
      BigInt(body.fee),
    );
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  transactions(
    @CurrentUser() user: JwtUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.pools.getTransactionsByAddress(user.walletAddress, page, limit);
  }
}

// ─── Lender Routes ───────────────────────────────────────────

@Controller('lender')
export class LenderRoutesController {
  constructor(private readonly pools: PoolsService) {}

  @Get('positions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('lender')
  positions(@CurrentUser() user: JwtUser) {
    return this.pools.lenderPositions(user.walletAddress);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('lender')
  transactions(
    @CurrentUser() user: JwtUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.pools.getTransactionsByAddress(user.walletAddress, page, limit);
  }

  @Get('performance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('lender')
  performance() {
    return this.pools.getLenderPerformance();
  }
}

// ─── Manager Routes ──────────────────────────────────────────

@Controller('manager')
export class ManagerRoutesController {
  constructor(private readonly poolsService: PoolsService) {}

  @Get('aum')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  aum() {
    return this.poolsService.managerSummary();
  }

  @Get('pools')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  listManagedPools() {
    return this.poolsService.managerSummary();
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  transactions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.poolsService.getManagerTransactions(page, limit);
  }
}
