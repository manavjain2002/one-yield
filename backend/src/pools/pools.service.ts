import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PoolEntity } from '../entities/pool.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { BorrowerPoolEntity } from '../entities/borrower-pool.entity';
import { TransactionRecordEntity } from '../entities/transaction-record.entity';
import { ContractEncodeService } from '../blockchain/contract-encode.service';
import { QueueService } from '../queue/queue.service';
import { SignerService } from '../blockchain/signer.service';
import { ChainalysisService } from '../screening/chainalysis.service';
import { LenderPositionEntity } from '../entities/lender-position.entity';
import { QueueJobEntity } from '../entities/queue-job.entity';

export interface CreatePoolDto {
  name: string;
  symbol: string;
  poolManagerAddress: string;
  poolTokenAddress: string;
  oracleManagerAddress: string;
  feeCollectorAddress: string;
  apyBasisPoints: number;
  poolSize: bigint;
}

export interface AllocationDto {
  v1PoolId: string;
  allocationBps: number;
  dedicatedWalletAddress: string;
}

@Injectable()
export class PoolsService {
  constructor(
    @InjectRepository(PoolEntity)
    private readonly pools: Repository<PoolEntity>,
    @InjectRepository(PoolDraftEntity)
    private readonly drafts: Repository<PoolDraftEntity>,
    @InjectRepository(BorrowerPoolEntity)
    private readonly borrowerPools: Repository<BorrowerPoolEntity>,
    @InjectRepository(TransactionRecordEntity)
    private readonly txs: Repository<TransactionRecordEntity>,
    @InjectRepository(LenderPositionEntity)
    private readonly positions: Repository<LenderPositionEntity>,
    @InjectRepository(QueueJobEntity)
    private readonly queueJobs: Repository<QueueJobEntity>,
    private readonly config: ConfigService,
    private readonly encode: ContractEncodeService,
    private readonly queue: QueueService,
    private readonly signers: SignerService,
    private readonly screening: ChainalysisService,
  ) {}

  private factoryId(): string {
    const id = this.config.get<string>('hedera.factoryContractId')?.trim();
    if (!id || id === '0.0.0') {
      throw new BadRequestException('FACTORY_CONTRACT_ID not configured');
    }
    return id;
  }

  private sameBorrowerWallet(poolBorrower: string, jwtWallet: string): boolean {
    const a = poolBorrower.trim();
    const b = jwtWallet.trim();
    if (/^0x[a-fA-F0-9]{40}$/i.test(a) && /^0x[a-fA-F0-9]{40}$/i.test(b)) {
      return a.toLowerCase() === b.toLowerCase();
    }
    return a === b;
  }

  async listPools(status?: PoolEntity['status']) {
    const q = this.pools.createQueryBuilder('p');
    if (status) q.where('p.status = :status', { status });
    const rows = await q.orderBy('p.createdAt', 'DESC').getMany();
    return Promise.all(rows.map((p) => this.enrichPool(p)));
  }

  /** Sum lender deposits (indexed) for UI fill metrics */
  private async enrichPool(p: PoolEntity) {
    const raw = await this.positions
      .createQueryBuilder('pos')
      .select('COALESCE(SUM(CAST(pos.depositedAmount AS DECIMAL)), 0)', 'total')
      .where('pos.poolId = :id', { id: p.id })
      .getRawOne<{ total: string }>();
    const totalDeposited = raw?.total ?? '0';
    return { ...p, totalDeposited };
  }

  async getPool(idOrAddress: string) {
    const pool = await this.pools.findOne({
      where: [{ id: idOrAddress }, { contractAddress: idOrAddress }],
      relations: ['borrowerPools'],
    });
    if (!pool) throw new NotFoundException('Pool not found');
    return this.enrichPool(pool);
  }

  async getTransactions(idOrContract: string) {
    const pool = await this.pools.findOne({
      where: [{ id: idOrContract }, { contractAddress: idOrContract }],
    });
    const addr = pool?.contractAddress ?? idOrContract;
    return this.txs.find({
      where: { poolAddress: addr },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async createPoolRequest(borrowerAccountId: string, dto: CreatePoolDto) {
    if (!dto.poolTokenAddress?.trim()) {
      throw new BadRequestException('poolTokenAddress is required');
    }
    await this.screening.assertAddressAllowed(borrowerAccountId);
    if (!this.signers.hasSigner('role_manager')) {
      throw new BadRequestException('ROLE_MANAGER signer not configured');
    }

    const encoded = this.encode.encodeCreatePool({
      poolName: dto.name,
      poolSymbol: dto.symbol,
      poolManager: dto.poolManagerAddress,
      poolToken: dto.poolTokenAddress,
      oracleManager: dto.oracleManagerAddress,
      feeCollector: dto.feeCollectorAddress,
      projectedApy: BigInt(dto.apyBasisPoints),
      poolSize: dto.poolSize,
    });

    const normalizedBorrower = /^0x[a-fA-F0-9]{40}$/i.test(
      borrowerAccountId.trim(),
    )
      ? borrowerAccountId.trim().toLowerCase()
      : borrowerAccountId.trim();

    const draft = this.drafts.create({
      borrowerAddress: normalizedBorrower,
      name: dto.name,
      symbol: dto.symbol,
      apyBasisPoints: dto.apyBasisPoints,
      poolSize: dto.poolSize.toString(),
      poolTokenAddress: dto.poolTokenAddress,
      poolManagerAddress: dto.poolManagerAddress,
      oracleManagerAddress: dto.oracleManagerAddress,
      feeCollectorAddress: dto.feeCollectorAddress,
    });
    await this.drafts.save(draft);

    const { jobId } = await this.queue.addContractCall({
      walletKey: 'role_manager',
      contractId: this.factoryId(),
      functionName: 'createPool',
      payloadHex: Buffer.from(encoded).toString('hex'),
      draftId: draft.id,
    });

    return { jobId, draftId: draft.id };
  }

  async setAllocations(
    poolId: string,
    allocations: AllocationDto[],
    _accountId: string,
  ) {
    const pool = await this.getPool(poolId);
    const sum = allocations.reduce((s, a) => s + a.allocationBps, 0);
    if (sum !== 10_000) {
      throw new BadRequestException('Allocations must sum to 10000 basis points');
    }
    if (!this.signers.hasSigner('fm_admin')) {
      throw new BadRequestException('FM_ADMIN signer not configured');
    }

    const jobs: { jobId: string }[] = [];
    for (const a of allocations) {
      await this.screening.assertAddressAllowed(a.dedicatedWalletAddress);
      const encoded = this.encode.encodeAddPool(
        a.v1PoolId,
        a.allocationBps,
        a.dedicatedWalletAddress,
      );
      const { jobId } = await this.queue.addContractCall({
        walletKey: 'fm_admin',
        contractId: pool.fundManagerAddress,
        functionName: 'addPool',
        payloadHex: Buffer.from(encoded).toString('hex'),
        poolAddress: pool.contractAddress,
      });
      jobs.push({ jobId });
    }
    return { jobs };
  }

  async activatePool(poolId: string) {
    const pool = await this.getPool(poolId);
    const encoded = this.encode.encodeActivatePool();
    return this.queue.addContractCall({
      walletKey: 'pool_manager',
      contractId: pool.contractAddress,
      functionName: 'activatePool',
      payloadHex: Buffer.from(encoded).toString('hex'),
      poolAddress: pool.contractAddress,
    });
  }

  async pausePool(poolId: string) {
    const pool = await this.getPool(poolId);
    const encoded = this.encode.encodeFactoryPauseTarget(pool.contractAddress);
    return this.queue.addContractCall({
      walletKey: 'role_manager',
      contractId: this.factoryId(),
      functionName: 'pauseTarget',
      payloadHex: Buffer.from(encoded).toString('hex'),
      poolAddress: pool.contractAddress,
    });
  }

  async unpausePool(poolId: string) {
    const pool = await this.getPool(poolId);
    const encoded = this.encode.encodeFactoryUnpauseTarget(pool.contractAddress);
    return this.queue.addContractCall({
      walletKey: 'role_manager',
      contractId: this.factoryId(),
      functionName: 'unpauseTarget',
      payloadHex: Buffer.from(encoded).toString('hex'),
      poolAddress: pool.contractAddress,
    });
  }

  async deployFunds(poolId: string) {
    const pool = await this.getPool(poolId);
    const encoded = this.encode.encodeDeployFunds();
    return this.queue.addContractCall({
      walletKey: 'fm_admin',
      contractId: pool.fundManagerAddress,
      functionName: 'deployFunds',
      payloadHex: Buffer.from(encoded).toString('hex'),
      poolAddress: pool.contractAddress,
    });
  }

  async sendToReserve(
    poolId: string,
    amount: bigint,
    uptoQueuePosition: bigint,
  ) {
    const pool = await this.getPool(poolId);
    const encoded = this.encode.encodeSendToV2Reserve(
      amount,
      uptoQueuePosition,
    );
    return this.queue.addContractCall(
      {
        walletKey: 'fm_admin',
        contractId: pool.fundManagerAddress,
        functionName: 'sendToV2Reserve',
        payloadHex: Buffer.from(encoded).toString('hex'),
        poolAddress: pool.contractAddress,
      },
      { priority: 2 },
    );
  }

  async repay(
    borrowerAccountId: string,
    poolId: string,
    v1PoolId: string,
    amount: bigint,
    fee: bigint,
  ) {
    const pool = await this.getPool(poolId);
    if (!this.sameBorrowerWallet(pool.borrowerAddress, borrowerAccountId)) {
      throw new ForbiddenException('Not the borrower for this pool');
    }
    const row = await this.borrowerPools.findOne({
      where: { poolId: pool.id, v1PoolId },
    });
    if (!row) throw new NotFoundException('Borrower allocation not found');
    const walletKey = row.dedicatedWalletAddress;
    if (!this.signers.hasSigner(walletKey)) {
      throw new BadRequestException(
        'Dedicated wallet signer not configured in DEDICATED_WALLETS_JSON',
      );
    }
    const encoded = this.encode.encodePay(v1PoolId, amount, fee);
    return this.queue.addContractCall({
      walletKey,
      contractId: pool.fundManagerAddress,
      functionName: 'pay',
      payloadHex: Buffer.from(encoded).toString('hex'),
      poolAddress: pool.contractAddress,
    });
  }

  async borrowerPoolsFor(accountId: string) {
    const id = accountId.trim();
    if (/^0x[a-fA-F0-9]{40}$/i.test(id)) {
      const norm = id.toLowerCase();
      return this.pools
        .createQueryBuilder('p')
        .where('LOWER(p.borrowerAddress) = :addr', { addr: norm })
        .orderBy('p.createdAt', 'DESC')
        .getMany();
    }
    return this.pools.find({
      where: { borrowerAddress: id },
      order: { createdAt: 'DESC' },
    });
  }

  async lenderPositions(accountId: string) {
    const id = accountId.trim();
    if (/^0x[a-fA-F0-9]{40}$/i.test(id)) {
      const norm = id.toLowerCase();
      return this.positions
        .createQueryBuilder('pos')
        .leftJoinAndSelect('pos.pool', 'pool')
        .where('LOWER(pos.lenderAddress) = :addr', { addr: norm })
        .getMany();
    }
    return this.positions.find({
      where: { lenderAddress: id },
      relations: ['pool'],
    });
  }

  async managerSummary() {
    const all = await this.pools.find();
    let totalAum = 0n;
    for (const p of all) {
      totalAum += BigInt(p.assetUnderManagement || '0');
    }
    return {
      poolCount: all.length,
      totalAssetUnderManagement: totalAum.toString(),
      pools: all,
    };
  }

  /**
   * Idempotency: skip if same pending job exists (simplified check).
   */
  async hasPendingJob(
    contractAddress: string,
    functionName: string,
  ): Promise<boolean> {
    const row = await this.queueJobs
      .createQueryBuilder('q')
      .where('q.contractAddress = :c', { c: contractAddress })
      .andWhere('q.functionName = :f', { f: functionName })
      .andWhere('q.status IN (:...s)', { s: ['pending', 'processing'] })
      .getOne();
    return !!row;
  }
}
