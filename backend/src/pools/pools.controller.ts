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
} from '@nestjs/common';
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

class CreatePoolBody {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  symbol: string;

  /** Basis points; default 500 (5%). */
  @IsOptional()
  @IsInt()
  @Min(0)
  apyBasisPoints?: number;

  @IsString()
  poolSize: string;
}

class AllocationItem {
  @IsString()
  v1PoolId: string;

  @IsInt()
  @Min(1)
  @Max(10000)
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
  @IsString()
  poolId: string;

  @IsString()
  v1PoolId: string;

  @IsString()
  amount: string;

  @IsString()
  fee: string;
}

class SendReserveBody {
  @IsString()
  amount: string;

  @IsString()
  uptoQueuePosition: string;
}

@Controller('pools')
export class PoolsController {
  constructor(
    private readonly pools: PoolsService,
    private readonly config: ConfigService,
  ) {}

  private getRequiredHederaAddress(
    field: 'poolManagerAddress' | 'oracleManagerAddress' | 'feeCollectorAddress',
    displayName: string,
  ): string {
    const value = this.config.get<string>(`hedera.${field}`)?.trim();
    if (!value) {
      throw new BadRequestException(`${displayName} must be provided via ENV`);
    }
    return value;
  }

  @Get()
  @SkipThrottle()
  list(@Query('status') status?: PoolEntity['status']) {
    return this.pools.listPools(status);
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

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  create(@CurrentUser() user: JwtUser, @Body() body: CreatePoolBody) {
    const poolManagerAddress = this.getRequiredHederaAddress(
      'poolManagerAddress',
      'POOL_MANAGER_ADDRESS',
    );
    const oracleManagerAddress = this.getRequiredHederaAddress(
      'oracleManagerAddress',
      'ORACLE_MANAGER_ADDRESS',
    );
    const feeCollectorAddress = this.getRequiredHederaAddress(
      'feeCollectorAddress',
      'FEE_COLLECTOR_ADDRESS',
    );
    const poolTokenAddress = this.config
      .get<string>('hedera.mockUsdcEvmAddress')
      ?.trim();
    if (!poolTokenAddress) {
      throw new BadRequestException('MOCK_USDC_EVM_ADDRESS must be configured');
    }

    const data = {
      name: body.name,
      symbol: body.symbol,
      poolManagerAddress,
      poolTokenAddress,
      oracleManagerAddress,
      feeCollectorAddress,
      apyBasisPoints: body.apyBasisPoints !== undefined && body.apyBasisPoints !== null ? body.apyBasisPoints : 500,
      poolSize: BigInt(body.poolSize),
    }
    console.log('data', data.name);
    console.log('data', data.symbol);
    console.log('data', data.poolManagerAddress);
    console.log('data', data.poolTokenAddress);
    console.log('data', data.oracleManagerAddress);
    console.log('data', data.feeCollectorAddress);
    console.log('data', data.apyBasisPoints);

    return this.pools.createPoolRequest(user.accountId, {
      name: body.name,
      symbol: body.symbol,
      poolManagerAddress,
      poolTokenAddress,
      oracleManagerAddress,
      feeCollectorAddress,
      apyBasisPoints:
        body.apyBasisPoints !== undefined && body.apyBasisPoints !== null
          ? body.apyBasisPoints
          : 500,
      poolSize: BigInt(body.poolSize),
    });
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
    return this.pools.setAllocations(id, body.allocations, user.accountId);
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
    return this.pools.sendToReserve(
      id,
      BigInt(body.amount),
      BigInt(body.uptoQueuePosition),
    );
  }
}

@Controller('borrower')
export class BorrowerRoutesController {
  constructor(private readonly pools: PoolsService) {}

  @Get('pools')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  myPools(@CurrentUser() user: JwtUser) {
    return this.pools.borrowerPoolsFor(user.accountId);
  }

  @Post('repay')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('borrower')
  repay(@CurrentUser() user: JwtUser, @Body() body: RepayBody) {
    return this.pools.repay(
      user.accountId,
      body.poolId,
      body.v1PoolId,
      BigInt(body.amount),
      BigInt(body.fee),
    );
  }
}

@Controller('lender')
export class LenderRoutesController {
  constructor(private readonly pools: PoolsService) {}

  @Get('positions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('lender')
  positions(@CurrentUser() user: JwtUser) {
    return this.pools.lenderPositions(user.accountId);
  }

  @Get('positions/:poolId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('lender')
  async position(
    @CurrentUser() user: JwtUser,
    @Param('poolId') poolId: string,
  ) {
    const list = await this.pools.lenderPositions(user.accountId);
    return list.find((p) => p.poolId === poolId || p.pool?.contractAddress === poolId) ?? null;
  }
}

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
}
