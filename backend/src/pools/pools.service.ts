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
import { BorrowerWalletEntity } from '../entities/borrower-wallet.entity';
import { TransactionRecordEntity, TxType } from '../entities/transaction-record.entity';
import { LenderPositionEntity } from '../entities/lender-position.entity';
import { QueueJobEntity } from '../entities/queue-job.entity';
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

  async getTransactions(idOrContract: string) {
    let addr = idOrContract;
    const pool = await this.pools.findOne({
      where: [{ id: idOrContract }, { contractAddress: idOrContract }],
    });
    if (pool) {
      addr = pool.contractAddress;
    } else {
      const draft = await this.drafts.findOne({ where: { id: idOrContract } });
      if (draft && draft.txHash) {
        addr = draft.txHash;
      }
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
      .select('COALESCE(SUM(CAST(pos.depositedAmount AS DECIMAL)), 0)', 'total')
      .where('pos.poolId = :id', { id: p.id })
      .getRawOne<{ total: string }>();
    return { ...p, totalDeposited: raw?.total ?? '0' };
  }

  // ─── Pool Creation (borrower signs tx from frontend) ──────

  /**
   * Saves a pool draft and immediately executes the transaction using the configured
   * manager private key. Optionally handles an uploaded file for off-chain metrics.
   */
  async createPoolDirect(borrowerIdentifier: string, dto: CreatePoolDto, file?: Express.Multer.File) {
    if (!dto.poolTokenAddress?.trim()) {
      throw new BadRequestException('poolTokenAddress is required');
    }
    await this.screening.assertAddressAllowed(borrowerIdentifier);

    const normalizedBorrower = (borrowerIdentifier || 'anonymous').trim().toLowerCase();

    // The backend uses its own manager private key to send the transaction directly.
    const managerPk = this.config.get<string>('POOL_MANAGER_PRIVATE_KEY');
    if (!managerPk) {
      throw new BadRequestException('POOL_MANAGER_PRIVATE_KEY must be configured on the backend (.env)');
    }

    // Save draft (will be linked to on-chain pool by indexer)
    const draft = this.drafts.create({
      borrowerAddress: normalizedBorrower,
      name: dto.name,
      symbol: dto.symbol,
      apyBasisPoints: dto.apyBasisPoints,
      poolSize: dto.poolSize,
      poolTokenAddress: dto.poolTokenAddress,
      oracleManagerAddress: dto.oracleManagerAddress,
      poolManagerAddress: dto.poolManagerAddress,
      feeCollectorAddress: dto.feeCollectorAddress,
    });

    // Log the file upload to demonstrate handling the compliance document
    if (file) {
      console.log(`[File Received] Pool Creation document: ${file.originalname} (${file.size} bytes)`);
    }

    await this.drafts.save(draft);

    try {
      const { ethers } = await import('ethers');
      const factory = this.contracts.factory('role_manager');

      const tx = await factory.createPool(
        dto.name,
        dto.symbol,
        dto.poolManagerAddress || this.config.get<string>('POOL_MANAGER_ADDRESS'),
        dto.poolTokenAddress,
        dto.oracleManagerAddress || this.config.get<string>('ORACLE_MANAGER_ADDRESS'),
        dto.feeCollectorAddress || this.config.get<string>('FEE_COLLECTOR_ADDRESS'),
        BigInt(dto.apyBasisPoints),
        BigInt(dto.poolSize)
      );

      const receipt = await tx.wait();

      draft.txHash = tx.hash;
      await this.drafts.save(draft);

      const txRecord = this.txs.create({
        txHash: tx.hash,
        type: 'create_pool',
        fromAddress: this.contracts.getSigner('role_manager').address,
        toAddress: this.contracts.factoryAddress(),
        status: 'pending', // will be 'confirmed' by indexer
        amount: draft.poolSize,
        tokenAddress: draft.poolTokenAddress,
        poolAddress: tx.hash, // Use txHash as temporary pool address until indexed
      });
      await this.txs.save(txRecord);

      return {
        draftId: draft.id,
        txHash: tx.hash,
        status: 'success'
      };
    } catch (err: unknown) {
      console.error('❌ Direct pool creation failed:', err);
      draft.indexed = true; // Mark as done so it doesn't stay pending
      await this.drafts.save(draft);
      const msg = (err as any).reason ?? (err as any).message ?? 'Unknown error';
      throw new BadRequestException(`Blockchain deployment failed: ${msg}`);
    }
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
    uptoQueuePosition: bigint,
  ) {
    const pool = await this.getPool(poolId);
    const result = await this.queue.addContractCall(
      {
        signerKey: 'fm_admin',
        contractAddress: pool.fundManagerAddress,
        abi: 'fund_manager',
        functionName: 'sendToV2Reserve',
        args: [amount.toString(), uptoQueuePosition.toString()],
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

  async borrowerPoolsFor(walletAddress?: string, username?: string) {
    if (!walletAddress && !username) return [];

    let pools: PoolEntity[] = [];
    const addr = walletAddress?.trim().toLowerCase();
    const uname = username?.trim().toLowerCase();

    const query = this.pools.createQueryBuilder('p');
    if (addr && uname) {
      query.where('(LOWER(p.borrowerAddress) = :addr OR LOWER(p.borrowerAddress) = :uname)', { addr, uname });
    } else if (addr) {
      query.where('LOWER(p.borrowerAddress) = :addr', { addr });
    } else if (uname) {
      query.where('LOWER(p.borrowerAddress) = :uname', { uname });
    }

    if (addr || uname) {
      pools = await query.orderBy('p.createdAt', 'DESC').getMany();
    }

    // Also fetch drafts by identifier
    const whereConditions: any[] = [];
    if (addr) whereConditions.push({ indexed: false, borrowerAddress: addr });
    if (uname) whereConditions.push({ indexed: false, borrowerAddress: uname });

    const drafts = whereConditions.length > 0
      ? await this.poolDrafts.find({ where: whereConditions, order: { createdAt: 'DESC' } })
      : [];

    const pendingPools = drafts.map((d) => this.mapDraftToPoolEntity(d));

    return [...pendingPools, ...pools];
  }

  async getBorrowerWallets(borrowerIdentifier: string) {
    return this.borrowerWallets.find({ where: { borrowerIdentifier } });
  }

  async setBorrowerWallet(borrowerIdentifier: string, tokenAddress: string, walletAddress: string) {
    let wallet = await this.borrowerWallets.findOne({ where: { borrowerIdentifier, tokenAddress } });
    if (!wallet) {
      wallet = this.borrowerWallets.create({ borrowerIdentifier, tokenAddress, walletAddress });
    } else {
      wallet.walletAddress = walletAddress;
    }
    await this.borrowerWallets.save(wallet);
    return wallet;
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
    let totalAum = 0n;
    for (const p of all) {
      totalAum += BigInt(p.assetUnderManagement || '0');
    }

    const drafts = await this.poolDrafts.find({
      where: { indexed: false },
      order: { createdAt: 'DESC' },
    });
    const pendingPools = drafts.map((d) => this.mapDraftToPoolEntity(d));

    const combinedPools = [...pendingPools, ...all];

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
    const tx = this.txs.create({
      txHash: dto.txHash,
      type: dto.type as TxType,
      fromAddress,
      toAddress: dto.toAddress || null,
      amount: dto.amount,
      tokenAddress: dto.tokenAddress || null,
      poolId: dto.poolId || null,
      status: 'pending',
    });
    await this.txs.save(tx);
    return { success: true, txId: tx.id };
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
      status: 'pending',
      poolTokenAddress: draft.poolTokenAddress,
      apyBasisPoints: draft.apyBasisPoints,
      poolSize: draft.poolSize,
      assetUnderManagement: '0',
      borrowerAddress: draft.borrowerAddress,
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
