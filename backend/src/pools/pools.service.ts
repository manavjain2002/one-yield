import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { randomUUID } from 'crypto';
import { extname, join, resolve } from 'path';
import { ethers } from 'ethers';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PoolEntity } from '../entities/pool.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { BorrowerPoolEntity } from '../entities/borrower-pool.entity';
import { BorrowerWalletEntity } from '../entities/borrower-wallet.entity';
import { TransactionRecordEntity, TxType } from '../entities/transaction-record.entity';
import { LenderPositionEntity } from '../entities/lender-position.entity';
import { QueueJobEntity } from '../entities/queue-job.entity';
import { UserEntity } from '../entities/user.entity';
import { ContractService } from '../contracts/contract.service';
import { QueueService } from '../queue/queue.service';
import { ChainalysisService } from '../screening/chainalysis.service';
import { POOL_FACTORY_ABI } from '../contracts/abis';

// ─── DTOs ────────────────────────────────────────────────────

export interface CreatePoolDto {
  name: string;
  symbol: string;
  poolManagerAddress: string;
  poolTokenAddress: string;
  oracleManagerAddress: string;
  feeCollectorAddress: string;
  apyBasisPoints: number;
  poolSize: string; // string to handle large numbers
}

export interface AllocationDto {
  v1PoolId: string;
  allocationBps: number;
  dedicatedWalletAddress: string;
}

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class PoolsService {
  constructor(
    @InjectRepository(PoolEntity)
    private readonly pools: Repository<PoolEntity>,
    @InjectRepository(PoolDraftEntity)
    private readonly drafts: Repository<PoolDraftEntity>,
    @InjectRepository(PoolDraftEntity)
    private readonly poolDrafts: Repository<PoolDraftEntity>,
    @InjectRepository(BorrowerPoolEntity)
    private readonly borrowerPools: Repository<BorrowerPoolEntity>,
    @InjectRepository(BorrowerWalletEntity)
    private readonly borrowerWallets: Repository<BorrowerWalletEntity>,
    @InjectRepository(TransactionRecordEntity)
    private readonly txs: Repository<TransactionRecordEntity>,
    @InjectRepository(LenderPositionEntity)
    private readonly positions: Repository<LenderPositionEntity>,
    @InjectRepository(QueueJobEntity)
    private readonly queueJobs: Repository<QueueJobEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly config: ConfigService,
    private readonly contracts: ContractService,
    private readonly queue: QueueService,
    private readonly screening: ChainalysisService,
  ) { }

  // ─── Pool Queries ──────────────────────────────────────────

  async listPools(status?: PoolEntity['status']) {
    const q = this.pools.createQueryBuilder('p');
    if (status) q.where('p.status = :status', { status });
    const rows = await q.orderBy('p.createdAt', 'DESC').getMany();
    return Promise.all(rows.map((p) => this.enrichPool(p)));
  }

  async getPool(idOrAddress: string) {
    let pool = await this.pools.findOne({
      where: [{ id: idOrAddress }, { contractAddress: idOrAddress }],
      relations: ['borrowerPools'],
    });

    if (!pool) {
      // Check if it's a draft
      const draft = await this.drafts.findOne({ where: { id: idOrAddress } });
      if (draft) pool = this.mapDraftToPoolEntity(draft);
    }

    if (!pool) throw new NotFoundException('Pool not found');
    return this.enrichPool(pool);
  }

  /** Trim + uppercase for stable comparisons with stored pool/draft rows. */
  private static normalizePoolIdentityField(value: string | undefined): string {
    return (value || '').trim().toUpperCase();
  }

  private async isPoolNameTaken(normalizedName: string): Promise<boolean> {
    const [inPools, inDrafts] = await Promise.all([
      this.pools.createQueryBuilder('p').where('UPPER(TRIM(p.name)) = :name', { name: normalizedName }).getExists(),
      this.drafts.createQueryBuilder('d').where('UPPER(TRIM(d.name)) = :name', { name: normalizedName }).getExists(),
    ]);
    return inPools || inDrafts;
  }

  private async isPoolSymbolTaken(normalizedSymbol: string): Promise<boolean> {
    const [inPools, inDrafts] = await Promise.all([
      this.pools.createQueryBuilder('p').where('UPPER(TRIM(p.symbol)) = :symbol', { symbol: normalizedSymbol }).getExists(),
      this.drafts.createQueryBuilder('d').where('UPPER(TRIM(d.symbol)) = :symbol', { symbol: normalizedSymbol }).getExists(),
    ]);
    return inPools || inDrafts;
  }

  async checkPoolIdentityAvailability(name?: string, symbol?: string) {
    const normalizedName = PoolsService.normalizePoolIdentityField(name);
    const normalizedSymbol = PoolsService.normalizePoolIdentityField(symbol);

    if (!normalizedName && !normalizedSymbol) {
      throw new BadRequestException('Provide name and/or symbol');
    }

    const [nameTaken, symbolTaken] = await Promise.all([
      normalizedName ? this.isPoolNameTaken(normalizedName) : Promise.resolve(false),
      normalizedSymbol ? this.isPoolSymbolTaken(normalizedSymbol) : Promise.resolve(false),
    ]);

    return {
      nameUnique: normalizedName ? !nameTaken : true,
      symbolUnique: normalizedSymbol ? !symbolTaken : true,
    };
  }

  async getTransactions(idOrContract: string) {
    const pool = await this.pools.findOne({
      where: [{ id: idOrContract }, { contractAddress: idOrContract }],
    });
    if (pool) {
      return this.txs.find({
        where: [{ poolAddress: pool.contractAddress }, { poolId: pool.id }],
        order: { createdAt: 'DESC' },
        take: 200,
      });
    }

    let addr = idOrContract;
    const draft = await this.drafts.findOne({ where: { id: idOrContract } });
    if (draft && draft.txHash) {
      addr = draft.txHash;
    }

    return this.txs.find({
      where: { poolAddress: addr },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /** Read live on-chain pool state. */
  async getOnChainState(poolId: string) {
    const pool = await this.getPool(poolId);
    const contract = this.contracts.pool(pool.contractAddress);
    const [totalAssets, aum] = await Promise.all([
      contract.totalAssets(),
      contract.assetUnderManagement(),
    ]);
    return {
      contractAddress: pool.contractAddress,
      totalAssets: totalAssets.toString(),
      assetUnderManagement: aum.toString(),
    };
  }

  /** Sum lender deposits for UI fill metrics. */
  private async enrichPool(p: PoolEntity) {
    const raw = await this.positions
      .createQueryBuilder('pos')
      .select('COALESCE(SUM(CAST(pos.depositedAmount AS DECIMAL)), 0)', 'totalDeposited')
      .addSelect('COALESCE(SUM(CAST(pos.withdrawnAmount AS DECIMAL)), 0)', 'totalWithdrawn')
      .where('pos.poolId = :id', { id: p.id })
      .getRawOne<{ totalDeposited: string; totalWithdrawn: string }>();

    let totalDeployed = 0n;
    let totalRepaid = 0n;
    if (p.borrowerPools) {
      for (const bp of p.borrowerPools) {
        totalDeployed += BigInt(bp.fundsDeployed || '0');
        totalRepaid += BigInt(bp.fundsRepaid || '0');
      }
    } else {
      const bps = await this.borrowerPools.find({ where: { poolId: p.id } });
      for (const bp of bps) {
        totalDeployed += BigInt(bp.fundsDeployed || '0');
        totalRepaid += BigInt(bp.fundsRepaid || '0');
      }
    }

    return {
      ...p,
      totalDeposited: raw?.totalDeposited ?? '0',
      totalWithdrawn: raw?.totalWithdrawn ?? '0',
      totalDeployed: totalDeployed.toString(),
      totalRepaid: totalRepaid.toString()
    };
  }

  // ─── Pool Creation (borrower signs tx from frontend) ──────

  /**
   * Saves a pool draft and required loan tape file. On-chain creation is performed
   * by an admin from the portal; this path does not send a factory transaction.
   */
  async createPoolDirect(borrowerIdentifier: string, dto: CreatePoolDto, file?: Express.Multer.File) {
    const normalizedName = PoolsService.normalizePoolIdentityField(dto.name);
    const normalizedSymbol = PoolsService.normalizePoolIdentityField(dto.symbol);

    if (!normalizedName) {
      throw new BadRequestException('Pool name is required');
    }
    if (!normalizedSymbol) {
      throw new BadRequestException('Pool symbol is required');
    }

    const availability = await this.checkPoolIdentityAvailability(normalizedName, normalizedSymbol);
    if (!availability.nameUnique && !availability.symbolUnique) {
      throw new BadRequestException('Pool name and symbol already exist. Use unique values.');
    }
    if (!availability.nameUnique) {
      throw new BadRequestException('Pool name already exists. Use a unique name.');
    }
    if (!availability.symbolUnique) {
      throw new BadRequestException('Pool symbol already exists. Use a unique symbol.');
    }

    if (!dto.poolTokenAddress?.trim()) {
      throw new BadRequestException('poolTokenAddress is required');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Loan tape upload is required');
    }
    await this.screening.assertAddressAllowed(borrowerIdentifier);

    const normalizedBorrower = (borrowerIdentifier || 'anonymous').trim().toLowerCase();

    const draft = this.drafts.create({
      borrowerIdentifier: normalizedBorrower,
      name: normalizedName,
      symbol: normalizedSymbol,
      apyBasisPoints: dto.apyBasisPoints,
      poolSize: dto.poolSize,
      poolTokenAddress: dto.poolTokenAddress,
      oracleManagerAddress: dto.oracleManagerAddress,
      poolManagerAddress: dto.poolManagerAddress,
      feeCollectorAddress: dto.feeCollectorAddress,
    });

    const uploadRoot =
      this.config.get<string>('UPLOAD_DIR')?.trim() || join(process.cwd(), 'uploads');
    const relDir = 'pool-drafts';
    const absDir = join(uploadRoot, relDir);
    await mkdir(absDir, { recursive: true });
    const ext = extname(file.originalname || '') || '.bin';
    const storedName = `${randomUUID()}${ext}`;
    const absPath = join(absDir, storedName);
    await writeFile(absPath, file.buffer);
    draft.documentPath = join(relDir, storedName).replace(/\\/g, '/');
    draft.documentOriginalName = file.originalname || storedName;

    await this.drafts.save(draft);

    return {
      draftId: draft.id,
      status: 'pending_approval',
      message:
        'Draft submitted for review. An administrator will create the pool on-chain after approval.',
    };
  }

  async listPendingPoolDraftsForAdmin() {
    const rows = await this.drafts.find({
      where: { indexed: false },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(
      rows.map(async (d) => ({
        id: d.id,
        borrowerIdentifier: d.borrowerIdentifier,
        name: d.name,
        symbol: d.symbol,
        apyBasisPoints: d.apyBasisPoints,
        poolSize: d.poolSize,
        poolTokenAddress: d.poolTokenAddress,
        hasDocument: Boolean(d.documentPath),
        documentOriginalName: d.documentOriginalName,
        createdAt: d.createdAt,
        borrower: await this.resolveBorrowerProfileForDraft(d.borrowerIdentifier),
      })),
    );
  }

  private async resolveBorrowerProfileForDraft(borrowerIdentifier: string): Promise<{
    username: string | null;
    walletAddress: string | null;
    displayName: string | null;
    email: string | null;
    country: string | null;
    role: string;
  } | null> {
    const id = (borrowerIdentifier || '').trim().toLowerCase();
    if (!id) return null;
    const isEvmAddr = /^0x[a-f0-9]{40}$/.test(id);
    const user = isEvmAddr
      ? await this.users.findOne({ where: { walletAddress: id } })
      : await this.users.findOne({ where: { username: id } });
    if (!user) return null;
    return {
      username: user.username,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      email: user.email,
      country: user.country,
      role: user.role,
    };
  }

  async getPoolDraftForAdmin(id: string) {
    const d = await this.drafts.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Draft not found');
    const borrower = await this.resolveBorrowerProfileForDraft(d.borrowerIdentifier);
    return {
      id: d.id,
      borrowerIdentifier: d.borrowerIdentifier,
      name: d.name,
      symbol: d.symbol,
      apyBasisPoints: d.apyBasisPoints,
      poolSize: d.poolSize,
      poolTokenAddress: d.poolTokenAddress,
      poolManagerAddress: d.poolManagerAddress,
      oracleManagerAddress: d.oracleManagerAddress,
      feeCollectorAddress: d.feeCollectorAddress,
      hasDocument: Boolean(d.documentPath),
      documentOriginalName: d.documentOriginalName,
      indexed: d.indexed,
      txHash: d.txHash,
      createdAt: d.createdAt,
      borrower,
    };
  }

  async resolveDraftFileForDownload(id: string): Promise<{ absolutePath: string; downloadName: string }> {
    const d = await this.drafts.findOne({ where: { id } });
    if (!d?.documentPath) throw new NotFoundException('No file for this draft');
    if (d.documentPath.includes('..')) throw new BadRequestException('Invalid stored path');
    const uploadRoot = this.config.get<string>('UPLOAD_DIR')?.trim() || join(process.cwd(), 'uploads');
    const abs = resolve(join(uploadRoot, d.documentPath));
    const rootResolved = resolve(uploadRoot);
    if (!abs.startsWith(rootResolved + '/') && abs !== rootResolved) {
      throw new BadRequestException('Invalid file path');
    }
    return {
      absolutePath: abs,
      downloadName: d.documentOriginalName || 'document',
    };
  }

  // ─── Allocations ───────────────────────────────────────────

  async setAllocations(
    poolId: string,
    allocations: AllocationDto[],
    borrowerIdentifier: string,
  ) {
    const pool = await this.getPool(poolId);
    if (!this.sameBorrowerWallet(pool.borrowerAddress, borrowerIdentifier)) {
      throw new ForbiddenException('Not the borrower for this pool');
    }
    const sum = allocations.reduce((s, a) => s + a.allocationBps, 0);
    if (sum !== 10_000) {
      throw new BadRequestException('Allocations must sum to 10000 basis points');
    }
    if (!this.contracts.hasSigner('fm_admin')) {
      throw new BadRequestException('FM_ADMIN signer not configured');
    }

    const jobs: { jobId: string }[] = [];
    for (const a of allocations) {
      await this.screening.assertAddressAllowed(a.dedicatedWalletAddress);
      const { jobId } = await this.queue.addContractCall({
        signerKey: 'fm_admin',
        contractAddress: pool.fundManagerAddress,
        abi: 'fund_manager',
        functionName: 'addPool',
        args: [a.v1PoolId, a.allocationBps, a.dedicatedWalletAddress],
        meta: { poolId: pool.id },
      });
      jobs.push({ jobId });
    }
    return { jobs };
  }

  // ─── Pool Manager Actions ─────────────────────────────────

  async activatePool(poolId: string) {
    const pool = await this.getPool(poolId);
    const result = await this.queue.addContractCall({
      signerKey: 'pool_manager',
      contractAddress: pool.contractAddress,
      abi: 'pool',
      functionName: 'activatePool',
      args: [],
      meta: { poolId: pool.id },
    });

    await this.recordAction(pool.id, 'activate', '0', pool.contractAddress, result.jobId);
    return result;
  }

  async pausePool(poolId: string) {
    const pool = await this.getPool(poolId);
    const result = await this.queue.addContractCall({
      signerKey: 'role_manager',
      contractAddress: this.contracts.factoryAddress(),
      abi: 'factory',
      functionName: 'pauseTarget',
      args: [pool.contractAddress],
      meta: { poolId: pool.id },
    });

    await this.recordAction(pool.id, 'pause', '0', pool.contractAddress, result.jobId);
    return result;
  }

  async unpausePool(poolId: string) {
    const pool = await this.getPool(poolId);
    const result = await this.queue.addContractCall({
      signerKey: 'role_manager',
      contractAddress: this.contracts.factoryAddress(),
      abi: 'factory',
      functionName: 'unpauseTarget',
      args: [pool.contractAddress],
      meta: { poolId: pool.id },
    });

    await this.recordAction(pool.id, 'unpause', '0', pool.contractAddress, result.jobId);
    return result;
  }

  async deployFunds(poolId: string) {
    const pool = await this.getPool(poolId);
    const result = await this.queue.addContractCall({
      signerKey: 'fm_admin',
      contractAddress: pool.fundManagerAddress,
      abi: 'fund_manager',
      functionName: 'deployFunds',
      args: [],
      meta: { poolId: pool.id },
    });

    await this.recordAction(pool.id, 'deploy_funds', '0', pool.fundManagerAddress, result.jobId);
    return result;
  }

  async sendToReserve(
    poolId: string,
    amount: bigint,
  ) {
    const pool = await this.getPool(poolId);
    const result = await this.queue.addContractCall(
      {
        signerKey: 'fm_admin',
        contractAddress: pool.fundManagerAddress,
        abi: 'fund_manager',
        functionName: 'sendToReserve',
        args: [amount.toString()],
        meta: { poolId: pool.id },
      },
      { priority: 2 },
    );

    await this.recordAction(pool.id, 'send_to_reserve', amount.toString(), pool.fundManagerAddress, result.jobId);
    return result;
  }

  // ─── Borrower Actions ─────────────────────────────────────

  async repay(
    borrowerAddress: string,
    poolId: string,
    v1PoolId: string,
    amount: bigint,
    fee: bigint,
  ) {
    const pool = await this.getPool(poolId);
    if (!this.sameBorrowerWallet(pool.borrowerAddress, borrowerAddress)) {
      throw new ForbiddenException('Not the borrower for this pool');
    }
    const row = await this.borrowerPools.findOne({
      where: { poolId: pool.id, v1PoolId },
    });
    if (!row) throw new NotFoundException('Borrower allocation not found');

    // Borrower repay uses the dedicated wallet signer
    const walletKey = row.dedicatedWalletAddress;
    if (!this.contracts.hasSigner(walletKey)) {
      throw new BadRequestException(
        'Dedicated wallet signer not configured',
      );
    }

    const result = await this.queue.addContractCall({
      signerKey: walletKey,
      contractAddress: pool.fundManagerAddress,
      abi: 'fund_manager',
      functionName: 'pay',
      args: [v1PoolId, amount.toString(), fee.toString()],
      meta: { poolId: pool.id },
    });

    await this.recordAction(pool.id, 'repay', amount.toString(), pool.fundManagerAddress, result.jobId);
    return result;
  }

  // ─── Role-specific queries ────────────────────────────────

  private normalizeBorrowerKeys(walletAddress?: string, username?: string) {
    return {
      addr: walletAddress?.trim().toLowerCase(),
      uname: username?.trim().toLowerCase(),
    };
  }

  /** Sum child borrower_pools rows for one master pool. */
  private sumBorrowerPoolChildAmounts(p: PoolEntity): { deployed: bigint; repaid: bigint } {
    let deployed = 0n;
    let repaid = 0n;
    for (const bp of p.borrowerPools ?? []) {
      deployed += BigInt(bp.fundsDeployed || '0');
      repaid += BigInt(bp.fundsRepaid || '0');
    }
    return { deployed, repaid };
  }

  private outstandingPrincipalNominalFromPoolEntity(p: PoolEntity): number {
    const { deployed, repaid } = this.sumBorrowerPoolChildAmounts(p);
    const out = deployed - repaid;
    if (out <= 0n) return 0;
    return Number(out) / 1e6;
  }

  /** Estimated coupon (display): principal × (APR% / 200). */
  private couponNominalForPoolEntity(p: PoolEntity): number {
    const pr = this.outstandingPrincipalNominalFromPoolEntity(p);
    const apy = (p.apyBasisPoints ?? 0) / 100;
    return pr * apy / 200;
  }

  private async loadPersistedMasterPoolsForBorrower(
    walletAddress?: string,
    username?: string,
  ): Promise<PoolEntity[]> {
    const { addr, uname } = this.normalizeBorrowerKeys(walletAddress, username);
    if (!addr && !uname) return [];

    const query = this.pools
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.borrowerPools', 'bp');
    if (addr && uname) {
      query.where('(LOWER(p.borrowerAddress) = :addr OR LOWER(p.borrowerAddress) = :uname)', { addr, uname });
    } else if (addr) {
      query.where('LOWER(p.borrowerAddress) = :addr', { addr });
    } else {
      query.where('LOWER(p.borrowerAddress) = :uname', { uname: uname! });
    }

    return query.orderBy('p.createdAt', 'DESC').getMany();
  }

  /**
   * Requirement 8 — portfolio KPIs from all persisted master pools (Σ child deployed − Σ child repaid).
   * Does not call other borrower dashboard export methods.
   */
  async getBorrowerDashboardSummary(walletAddress?: string, username?: string) {
    const list = await this.loadPersistedMasterPoolsForBorrower(walletAddress, username);
    let outstandingPrincipalNominal = 0;
    let outstandingCouponNominal = 0;
    for (const p of list) {
      outstandingPrincipalNominal += this.outstandingPrincipalNominalFromPoolEntity(p);
      outstandingCouponNominal += this.couponNominalForPoolEntity(p);
    }
    const activePoolCount = list.filter((p) => p.status === 'active' || p.status === 'pending').length;
    return {
      outstandingPrincipalNominal,
      outstandingCouponNominal,
      totalDebtNominal: outstandingPrincipalNominal + outstandingCouponNominal,
      activePoolCount,
    };
  }

  /**
   * Requirement 8 — active/pending master pools with per-pool metrics for dashboard list only.
   */
  async getBorrowerDashboardActivePools(walletAddress?: string, username?: string) {
    const persisted = await this.loadPersistedMasterPoolsForBorrower(walletAddress, username);
    const filtered = persisted.filter((p) => p.status === 'active' || p.status === 'pending');
    const enrichedList = await Promise.all(filtered.map((p) => this.enrichPool(p)));
    return enrichedList.map((enriched) => {
      const p = filtered.find((x) => x.id === enriched.id)!;
      const pr = this.outstandingPrincipalNominalFromPoolEntity(p);
      const c = this.couponNominalForPoolEntity(p);
      const { deployed, repaid } = this.sumBorrowerPoolChildAmounts(p);
      return {
        ...enriched,
        outstandingPrincipalNominal: pr,
        outstandingCouponNominal: c,
        totalOutstandingNominal: pr + c,
        totalDeployedNominal: Number(deployed) / 1e6,
        totalRepaidNominal: Number(repaid) / 1e6,
      };
    });
  }

  /**
   * Requirement 8 — full My Pools list (drafts + enriched masters) with page-specific metrics.
   */
  async getBorrowerMyPoolsPage(walletAddress?: string, username?: string) {
    const { addr, uname } = this.normalizeBorrowerKeys(walletAddress, username);
    const persisted = await this.loadPersistedMasterPoolsForBorrower(walletAddress, username);
    const enrichedList = await Promise.all(persisted.map((p) => this.enrichPool(p)));

    const withMetrics = enrichedList.map((enriched) => {
      const p = persisted.find((x) => x.id === enriched.id)!;
      const pr = this.outstandingPrincipalNominalFromPoolEntity(p);
      const c = this.couponNominalForPoolEntity(p);
      const { repaid } = this.sumBorrowerPoolChildAmounts(p);
      return {
        ...enriched,
        debtOwedPrincipalNominal: pr,
        couponAmountNominal: c,
        principalRepaidNominal: Number(repaid) / 1e6,
      };
    });

    const whereConditions: any[] = [];
    if (addr) whereConditions.push({ indexed: false, borrowerIdentifier: addr });
    if (uname) whereConditions.push({ indexed: false, borrowerIdentifier: uname });

    const drafts =
      whereConditions.length > 0
        ? await this.poolDrafts.find({ where: whereConditions, order: { createdAt: 'DESC' } })
        : [];

    const pendingPools = drafts.map((d) => ({
      ...this.mapDraftToPoolEntity(d),
      fundManagerAddress: '',
      debtOwedPrincipalNominal: 0,
      couponAmountNominal: 0,
      principalRepaidNominal: 0,
    }));

    return [...pendingPools, ...withMetrics];
  }

  async getBorrowerWallets(borrowerIdentifier: string) {
    return this.borrowerWallets.find({ where: { borrowerIdentifier } });
  }

  async setBorrowerWallet(borrowerIdentifier: string, tokenAddress: string, walletAddress: string) {
    const idNorm = borrowerIdentifier.trim().toLowerCase();
    const tokenNorm = tokenAddress.trim();
    const addrNorm = walletAddress.trim();
    const existing = await this.borrowerWallets.findOne({
      where: { borrowerIdentifier: idNorm, tokenAddress: tokenNorm },
    });
    if (existing) {
      existing.walletAddress = addrNorm;
      return this.borrowerWallets.save(existing);
    }
    return this.borrowerWallets.save(
      this.borrowerWallets.create({
        borrowerIdentifier: idNorm,
        tokenAddress: tokenNorm,
        walletAddress: addrNorm,
      }),
    );
  }

  async updateBorrowerWallet(walletId: string, walletAddress: string) {
    const wallet = await this.borrowerWallets.findOne({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    wallet.walletAddress = walletAddress;
    await this.borrowerWallets.save(wallet);
    return wallet;
  }

  async deleteBorrowerWallet(walletId: string) {
    const wallet = await this.borrowerWallets.findOne({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    await this.borrowerWallets.remove(wallet);
    return { deleted: true };
  }

  async lenderPositions(walletAddress: string) {
    if (!walletAddress) return [];
    const addr = walletAddress.trim().toLowerCase();
    return this.positions
      .createQueryBuilder('pos')
      .leftJoinAndSelect('pos.pool', 'pool')
      .where('LOWER(pos.lenderAddress) = :addr', { addr })
      .getMany();
  }

  async managerSummary() {
    const all = await this.pools.find({ relations: ['borrowerPools'] });
    const enrichedAll = await Promise.all(all.map((p) => this.enrichPool(p)));
    let totalAum = 0n;
    for (const p of enrichedAll) {
      totalAum += BigInt(p.assetUnderManagement || '0');
    }

    const drafts = await this.poolDrafts.find({
      where: { indexed: false },
      order: { createdAt: 'DESC' },
    });
    const pendingPools = drafts.map((d) => this.mapDraftToPoolEntity(d));

    const combinedPools = [...pendingPools, ...enrichedAll];

    return {
      poolCount: combinedPools.length,
      totalAssetUnderManagement: totalAum.toString(),
      pools: combinedPools,
    };
  }

  async getTransactionsByAddress(
    address: string,
    page: number = 1,
    limit: number = 10,
  ) {
    if (!address) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }
    const addr = address.trim().toLowerCase();
    const [items, total] = await this.txs
      .createQueryBuilder('t')
      .where('LOWER(t.fromAddress) = :addr', { addr })
      .orWhere('LOWER(t.toAddress) = :addr', { addr })
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLenderPerformance() {
    // Generate some deterministic history based on active pools
    const activePools = await this.pools.find({ where: { status: 'active' } });
    const avgApy = activePools.reduce((s, p) => s + (p.apyBasisPoints || 0), 0) / (activePools.length || 1) / 100;

    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    return months.map((month, i) => ({
      month,
      apy: (avgApy || 5) + Math.sin(i) * 0.5 // base + variance
    }));
  }

  async getManagerTransactions(page: number = 1, limit: number = 10) {
    const [items, total] = await this.txs
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  async recordManualActivity(fromAddress: string, dto: any) {
    const existing = await this.txs.findOne({ where: { txHash: dto.txHash } });
    if (existing) {
      existing.type = dto.type as TxType;
      existing.fromAddress = fromAddress ?? existing.fromAddress;
      existing.toAddress = dto.toAddress ?? existing.toAddress;
      existing.amount = dto.amount ?? existing.amount;
      existing.tokenAddress = dto.tokenAddress ?? existing.tokenAddress;
      existing.poolId = dto.poolId ?? existing.poolId;
      if (dto.status === 'confirmed') {
        existing.status = 'confirmed';
        existing.confirmedAt = new Date();
      }
      await this.txs.save(existing);
      return { success: true, txId: existing.id };
    }
    const tx = this.txs.create({
      txHash: dto.txHash,
      type: dto.type as TxType,
      fromAddress,
      toAddress: dto.toAddress || null,
      amount: dto.amount,
      tokenAddress: dto.tokenAddress || null,
      poolId: dto.poolId || null,
      status: dto.status === 'confirmed' ? 'confirmed' : 'pending',
      confirmedAt: dto.status === 'confirmed' ? new Date() : null,
    });
    await this.txs.save(tx);
    return { success: true, txId: tx.id };
  }

  // ─── Inline TX Confirmation (replaces indexer) ─────────────

  async confirmTransaction(
    txHash: string,
    type: string,
    poolId?: string,
    v1PoolId?: string,
    draftId?: string,
  ) {
    if (!txHash) throw new BadRequestException('txHash is required');

    const existingTx = await this.txs.findOne({ where: { txHash } });
    if (existingTx && existingTx.status !== 'confirmed') {
      existingTx.status = 'confirmed';
      existingTx.confirmedAt = new Date();
      await this.txs.save(existingTx);
    }

    switch (type) {
      case 'activate': {
        if (!poolId) break;
        const pool = await this.pools.findOne({ where: { id: poolId } });
        if (pool) {
          pool.status = 'active';
          await this.pools.save(pool);
        }
        break;
      }
      case 'pause': {
        if (!poolId) break;
        const pool = await this.pools.findOne({ where: { id: poolId } });
        if (pool) {
          pool.status = 'paused';
          await this.pools.save(pool);
        }
        break;
      }
      case 'unpause': {
        if (!poolId) break;
        const pool = await this.pools.findOne({ where: { id: poolId } });
        if (pool) {
          pool.status = 'active';
          await this.pools.save(pool);
        }
        break;
      }
      case 'close': {
        if (!poolId) break;
        const pool = await this.pools.findOne({ where: { id: poolId } });
        if (pool) {
          pool.status = 'closed';
          await this.pools.save(pool);
        }
        break;
      }
      case 'create_pool': {
        const receipt = await this.contracts.getProvider().getTransactionReceipt(txHash);
        if (!receipt) throw new BadRequestException('Transaction receipt not found');
        const iface = new ethers.Interface([...POOL_FACTORY_ABI]);
        let poolAddr = '';
        let fmAddr = '';
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
            if (parsed?.name === 'PoolCreated') {
              poolAddr = String(parsed.args._pool).toLowerCase();
              fmAddr = String(parsed.args._assetManager).toLowerCase();
              break;
            }
          } catch {
            /* non-matching log */
          }
        }
        if (!poolAddr) throw new BadRequestException('PoolCreated event not found in receipt');

        let draft: PoolDraftEntity | null = null;
        if (draftId) {
          draft = await this.drafts.findOne({ where: { id: draftId } });
        }
        if (!draft) {
          draft = await this.drafts.findOne({ where: { txHash } });
        }
        if (!draft) {
          throw new BadRequestException('Pool draft not found; include draftId from the approval flow');
        }

        const existingPool = await this.pools.findOne({ where: { contractAddress: poolAddr } });
        if (existingPool) {
          draft.txHash = txHash;
          draft.indexed = true;
          await this.drafts.save(draft);
          break;
        }

        draft.txHash = txHash;
        draft.indexed = true;
        await this.drafts.save(draft);

        const normalizedBorrower = (draft.borrowerIdentifier || '').trim().toLowerCase();
        const pool = this.pools.create({
          contractAddress: poolAddr,
          fundManagerAddress: fmAddr,
          name: draft.name,
          symbol: draft.symbol,
          draftId: draft.id,
          status: 'pending',
          poolTokenAddress: draft.poolTokenAddress,
          lpTokenAddress: poolAddr,
          apyBasisPoints: draft.apyBasisPoints,
          poolSize: draft.poolSize,
          assetUnderManagement: '0',
          borrowerAddress: normalizedBorrower,
          feeCollectorAddress: draft.feeCollectorAddress,
          poolManagerAddress: draft.poolManagerAddress,
          oracleManagerAddress: draft.oracleManagerAddress,
        });
        await this.pools.save(pool);

        let txRow = existingTx;
        if (!txRow) {
          txRow = this.txs.create({
            txHash,
            type: 'create_pool',
            fromAddress: null,
            toAddress: this.contracts.factoryAddress(),
            poolId: pool.id,
            poolAddress: poolAddr,
            amount: draft.poolSize,
            tokenAddress: draft.poolTokenAddress,
            status: 'confirmed',
            confirmedAt: new Date(),
          });
        } else {
          txRow.status = 'confirmed';
          txRow.confirmedAt = new Date();
          txRow.type = 'create_pool';
          txRow.poolId = pool.id;
          txRow.poolAddress = poolAddr;
        }
        await this.txs.save(txRow);
        break;
      }
      case 'deposit': {
        if (!poolId) break;
        const pool = await this.pools.findOne({ where: { id: poolId } });
        if (!pool) break;
        if (existingTx?.fromAddress && existingTx?.amount) {
          const lenderAddr = existingTx.fromAddress.toLowerCase();
          let pos = await this.positions.findOne({ where: { poolId, lenderAddress: lenderAddr } });
          if (!pos) {
            pos = this.positions.create({
              poolId,
              lenderAddress: lenderAddr,
              lpTokenBalance: '0',
              depositedAmount: '0',
              currentValue: '0',
              yieldEarned: '0',
              firstDepositAt: new Date(),
            });
          }
          const amt = BigInt(existingTx.amount || '0');
          pos.depositedAmount = (BigInt(pos.depositedAmount) + amt).toString();
          pos.currentValue = (BigInt(pos.currentValue) + amt).toString();
          pos.lastUpdatedAt = new Date();
          await this.positions.save(pos);
        }
        try {
          const aum = await this.contracts.pool(pool.contractAddress).assetUnderManagement();
          pool.assetUnderManagement = aum.toString();
          await this.pools.save(pool);
        } catch (e) { console.error('Failed to read AUM:', e); }
        break;
      }
      case 'withdraw': {
        if (!poolId) break;
        const pool = await this.pools.findOne({ where: { id: poolId } });
        if (!pool) break;
        if (existingTx?.fromAddress && existingTx?.amount) {
          const lenderAddr = existingTx.fromAddress.toLowerCase();
          const pos = await this.positions.findOne({ where: { poolId, lenderAddress: lenderAddr } });
          if (pos) {
            const amt = BigInt(existingTx.amount || '0');
            pos.currentValue = (BigInt(pos.currentValue) - amt).toString();
            if (BigInt(pos.currentValue) < 0n) pos.currentValue = '0';
            pos.withdrawnAmount = (BigInt(pos.withdrawnAmount || '0') + amt).toString();
            pos.lastUpdatedAt = new Date();
            await this.positions.save(pos);
          }
        }
        try {
          const aum = await this.contracts.pool(pool.contractAddress).assetUnderManagement();
          pool.assetUnderManagement = aum.toString();
          await this.pools.save(pool);
        } catch (e) { console.error('Failed to read AUM:', e); }
        break;
      }
      case 'repay': {
        if (!poolId) break;
        const pool = await this.pools.findOne({ where: { id: poolId } });
        if (!pool) break;
        if (existingTx?.amount) {
          const amt = BigInt(existingTx.amount || '0');
          let bp: BorrowerPoolEntity | null = null;
          if (v1PoolId) {
            bp = await this.borrowerPools.findOne({ where: { poolId, v1PoolId } });
          }
          if (!bp && existingTx.fromAddress) {
            const walletAddr = existingTx.fromAddress.toLowerCase();
            const rows = await this.borrowerPools.find({ where: { poolId } });
            bp = rows.find((r) => r.dedicatedWalletAddress.toLowerCase() === walletAddr) ?? null;
          }
          if (bp) {
            bp.fundsRepaid = (BigInt(bp.fundsRepaid || '0') + amt).toString();
            await this.borrowerPools.save(bp);
          }
        }
        try {
          const aum = await this.contracts.pool(pool.contractAddress).assetUnderManagement();
          pool.assetUnderManagement = aum.toString();
          await this.pools.save(pool);
        } catch (e) { console.error('Failed to read AUM:', e); }
        break;
      }
      case 'deploy_funds':
      case 'send_to_reserve':
      case 'sweep':
      case 'refill': {
        if (!poolId) break;
        const pool = await this.pools.findOne({ where: { id: poolId } });
        if (!pool) break;
        if (type === 'deploy_funds' && existingTx?.amount) {
          const rows = await this.borrowerPools.find({ where: { poolId } });
          const totalBps = rows.reduce((s, r) => s + (r.allocationBps || 0), 0);
          const totalAmt = BigInt(existingTx.amount || '0');
          if (rows.length > 0 && totalBps > 0) {
            for (const r of rows) {
              const share = (totalAmt * BigInt(r.allocationBps)) / BigInt(totalBps);
              r.fundsDeployed = (BigInt(r.fundsDeployed || '0') + share).toString();
              await this.borrowerPools.save(r);
            }
          } else if (rows.length === 1) {
            const r = rows[0];
            r.fundsDeployed = (BigInt(r.fundsDeployed || '0') + totalAmt).toString();
            await this.borrowerPools.save(r);
          }
        }
        try {
          const aum = await this.contracts.pool(pool.contractAddress).assetUnderManagement();
          pool.assetUnderManagement = aum.toString();
          await this.pools.save(pool);
        } catch (e) { console.error('Failed to read AUM:', e); }
        break;
      }
    }

    return { confirmed: true, txHash, type };
  }

  // ─── Child Pool CRUD (replaces indexer V1PoolAdded) ────────

  async addChildPool(poolId: string, v1PoolId: string, dedicatedWalletAddress: string, allocationBps?: number) {
    const pool = await this.pools.findOne({ where: { id: poolId } });
    if (!pool) throw new NotFoundException('Pool not found');

    const existing = await this.borrowerPools.findOne({ where: { poolId, v1PoolId } });
    if (existing) {
      existing.dedicatedWalletAddress = dedicatedWalletAddress.toLowerCase();
      if (allocationBps !== undefined) existing.allocationBps = allocationBps;
      await this.borrowerPools.save(existing);
      return existing;
    }

    const row = this.borrowerPools.create({
      poolId: pool.id,
      fundManagerAddress: pool.fundManagerAddress,
      v1PoolId,
      allocationBps: allocationBps ?? 0,
      dedicatedWalletAddress: dedicatedWalletAddress.toLowerCase(),
    });
    await this.borrowerPools.save(row);
    return row;
  }

  async removeChildPool(poolId: string, v1PoolId: string) {
    const row = await this.borrowerPools.findOne({ where: { poolId, v1PoolId } });
    if (!row) throw new NotFoundException('Child pool not found');
    await this.borrowerPools.remove(row);
    return { removed: true };
  }

  async updateChildPool(poolId: string, v1PoolId: string, updates: { allocationBps?: number; dedicatedWalletAddress?: string }) {
    const row = await this.borrowerPools.findOne({ where: { poolId, v1PoolId } });
    if (!row) throw new NotFoundException('Child pool not found');
    if (updates.allocationBps !== undefined) row.allocationBps = updates.allocationBps;
    if (updates.dedicatedWalletAddress) {
      row.dedicatedWalletAddress = updates.dedicatedWalletAddress.toLowerCase();
    }
    await this.borrowerPools.save(row);
    return row;
  }

  async getBorrowerWalletsForPool(poolId: string) {
    const pool = await this.pools.findOne({ where: { id: poolId } });
    if (!pool) throw new NotFoundException('Pool not found');
    const borrowerId = pool.borrowerAddress.trim().toLowerCase();
    const token = pool.poolTokenAddress.trim().toLowerCase();
    return this.borrowerWallets
      .createQueryBuilder('w')
      .where('LOWER(w.borrowerIdentifier) = :borrowerId', { borrowerId })
      .andWhere('LOWER(w.tokenAddress) = :token', { token })
      .getMany();
  }

  private async recordAction(
    poolId: string,
    type: string,
    amount: string,
    toAddress: string,
    jobId: string,
    tokenAddress?: string,
  ) {
    const tx = this.txs.create({
      txHash: `pending-${jobId}`,
      type: type as TxType,
      amount,
      toAddress,
      tokenAddress,
      status: 'pending',
      poolId,
    });
    await this.txs.save(tx);
  }
  // ─── Helpers ──────────────────────────────────────────────

  private sameBorrowerWallet(poolBorrower: string, jwtWallet: string): boolean {
    if (!poolBorrower || !jwtWallet) return false;
    return poolBorrower.trim().toLowerCase() === jwtWallet.trim().toLowerCase();
  }

  private mapDraftToPoolEntity(draft: PoolDraftEntity): any {
    return {
      id: draft.id,
      contractAddress: draft.txHash || draft.id, // For UI txHash fallback
      name: draft.name,
      symbol: draft.symbol,
      status: 'draft',
      poolTokenAddress: draft.poolTokenAddress,
      apyBasisPoints: draft.apyBasisPoints,
      poolSize: draft.poolSize,
      assetUnderManagement: '0',
      borrowerAddress: draft.borrowerIdentifier,
      feeCollectorAddress: draft.feeCollectorAddress,
      createdAt: draft.createdAt,
      totalDeposited: '0',
      borrowerPools: [],
    };
  }

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
