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
      borrowerIdentifier: normalizedBorrower,
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

      // Parse PoolCreated event to extract pool + fund manager addresses
      const { ethers: ethersLib } = await import('ethers');
      const iface = new ethersLib.Interface(POOL_FACTORY_ABI);
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
        } catch { }
      }

      draft.txHash = tx.hash;
      draft.indexed = true;
      await this.drafts.save(draft);

      // Create real PoolEntity from event data
      if (poolAddr) {
        const pool = this.pools.create({
          contractAddress: poolAddr,
          fundManagerAddress: fmAddr,
          name: dto.name,
          symbol: dto.symbol,
          status: 'pending',
          poolTokenAddress: dto.poolTokenAddress,
          lpTokenAddress: poolAddr,
          apyBasisPoints: dto.apyBasisPoints,
          poolSize: dto.poolSize,
          assetUnderManagement: '0',
          borrowerAddress: normalizedBorrower,
          feeCollectorAddress: dto.feeCollectorAddress,
          poolManagerAddress: dto.poolManagerAddress,
          oracleManagerAddress: dto.oracleManagerAddress,
        });
        await this.pools.save(pool);
      }

      const txRecord = this.txs.create({
        txHash: tx.hash,
        type: 'create_pool',
        fromAddress: this.contracts.getSigner('role_manager').address,
        toAddress: this.contracts.factoryAddress(),
        status: 'confirmed',
        amount: draft.poolSize,
        tokenAddress: draft.poolTokenAddress,
        poolAddress: poolAddr || tx.hash,
      });
      await this.txs.save(txRecord);

      return {
        draftId: draft.id,
        txHash: tx.hash,
        poolAddress: poolAddr,
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

  async borrowerPoolsFor(walletAddress?: string, username?: string) {
    if (!walletAddress && !username) return [];

    let pools: PoolEntity[] = [];
    const addr = walletAddress?.trim().toLowerCase();
    const uname = username?.trim().toLowerCase();

    const query = this.pools.createQueryBuilder('p')
      .leftJoinAndSelect('p.borrowerPools', 'bp');
    if (addr && uname) {
      query.where('(LOWER(p.borrowerAddress) = :addr OR LOWER(p.borrowerAddress) = :uname)', { addr, uname });
    } else if (addr) {
      query.where('LOWER(p.borrowerAddress) = :addr', { addr });
    } else if (uname) {
      query.where('LOWER(p.borrowerAddress) = :uname', { uname });
    }


    console.log('query', query.getQueryAndParameters());

    if (addr || uname) {
      pools = await query.orderBy('p.createdAt', 'DESC').getMany();
    }
    console.log("🚀 ~ PoolsService ~ borrowerPoolsFor ~ pools:", pools)

    // Also fetch drafts by identifier
    const whereConditions: any[] = [];
    if (addr) whereConditions.push({ indexed: false, borrowerIdentifier: addr });
    if (uname) whereConditions.push({ indexed: false, borrowerIdentifier: uname });

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
    const wallet = this.borrowerWallets.create({ borrowerIdentifier, tokenAddress, walletAddress });
    await this.borrowerWallets.save(wallet);
    return wallet;
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
      status: dto.status === 'confirmed' ? 'confirmed' : 'pending',
      confirmedAt: dto.status === 'confirmed' ? new Date() : null,
    });
    await this.txs.save(tx);
    return { success: true, txId: tx.id };
  }

  // ─── Inline TX Confirmation (replaces indexer) ─────────────

  async confirmTransaction(txHash: string, type: string, poolId?: string) {
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
        if (txHash) {
          const draft = await this.drafts.findOne({ where: { txHash } });
          if (draft && !draft.indexed) {
            draft.indexed = true;
            await this.drafts.save(draft);
          }
        }
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
        if (existingTx?.fromAddress && existingTx?.amount) {
          const walletAddr = existingTx.fromAddress.toLowerCase();
          const bp = await this.borrowerPools.findOne({
            where: { poolId, dedicatedWalletAddress: walletAddr },
          });
          if (bp) {
            const amt = BigInt(existingTx.amount || '0');
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
        if (type === 'deploy_funds' || type === 'send_to_reserve') {
          if (existingTx?.amount) {
            const bp = await this.borrowerPools.findOne({
              where: { poolId },
            });
            if (bp) {
              const amt = BigInt(existingTx.amount || '0');
              bp.fundsDeployed = (BigInt(bp.fundsDeployed || '0') + amt).toString();
              await this.borrowerPools.save(bp);
            }
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
      existing.dedicatedWalletAddress = dedicatedWalletAddress;
      if (allocationBps !== undefined) existing.allocationBps = allocationBps;
      await this.borrowerPools.save(existing);
      return existing;
    }

    const row = this.borrowerPools.create({
      poolId: pool.id,
      fundManagerAddress: pool.fundManagerAddress,
      v1PoolId,
      allocationBps: allocationBps ?? 0,
      dedicatedWalletAddress,
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
    if (updates.dedicatedWalletAddress) row.dedicatedWalletAddress = updates.dedicatedWalletAddress;
    await this.borrowerPools.save(row);
    return row;
  }

  async getBorrowerWalletsForPool(poolId: string) {
    const pool = await this.pools.findOne({ where: { id: poolId } });
    if (!pool) throw new NotFoundException('Pool not found');
    return this.borrowerWallets.find({
      where: { tokenAddress: pool.poolTokenAddress },
    });
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
