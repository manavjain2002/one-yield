import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractService } from '../contracts/contract.service';
import {
  POOL_FACTORY_ABI,
  LENDING_POOL_ABI,
  ASSET_MANAGER_ABI,
} from '../contracts/abis';
import { PoolEntity } from '../entities/pool.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { ContractRegistryEntity } from '../entities/contract-registry.entity';
import { IndexerStateEntity } from '../entities/indexer-state.entity';
import { TransactionRecordEntity } from '../entities/transaction-record.entity';
import { LenderPositionEntity } from '../entities/lender-position.entity';
import { AumHistoryEntity } from '../entities/aum-history.entity';
import { BorrowerPoolEntity } from '../entities/borrower-pool.entity';
import { EventsGateway } from '../websocket/events.gateway';

/**
 * Polls on-chain event logs using standard ethers.js getLogs
 * and updates the database accordingly.
 */
@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private pollRunning = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly contracts: ContractService,
    @InjectRepository(PoolEntity)
    private readonly pools: Repository<PoolEntity>,
    @InjectRepository(PoolDraftEntity)
    private readonly drafts: Repository<PoolDraftEntity>,
    @InjectRepository(ContractRegistryEntity)
    private readonly registry: Repository<ContractRegistryEntity>,
    @InjectRepository(IndexerStateEntity)
    private readonly indexerState: Repository<IndexerStateEntity>,
    @InjectRepository(TransactionRecordEntity)
    private readonly txs: Repository<TransactionRecordEntity>,
    @InjectRepository(LenderPositionEntity)
    private readonly positions: Repository<LenderPositionEntity>,
    @InjectRepository(AumHistoryEntity)
    private readonly aumHistory: Repository<AumHistoryEntity>,
    @InjectRepository(BorrowerPoolEntity)
    private readonly borrowerPools: Repository<BorrowerPoolEntity>,
    private readonly events: EventsGateway,
  ) {}

  onModuleInit() {
    const sec = this.config.get<number>('indexer.pollIntervalSec') ?? 15;
    this.timer = setInterval(() => void this.pollSafe(), sec * 1000);
    void this.pollSafe();
  }

  private async pollSafe() {
    if (this.pollRunning) return;
    this.pollRunning = true;
    try {
      await this.poll();
    } catch (e) {
      this.logger.error(`Indexer poll failed: ${e}`);
    } finally {
      this.pollRunning = false;
    }
  }

  // ─── Main Poll Loop ────────────────────────────────────────

  async poll() {
    await this.ensureFactoryRegistry();

    const addresses = new Set<string>();

    // Always index the factory
    try {
      const factoryAddr = this.contracts.factoryAddress();
      addresses.add(factoryAddr.toLowerCase());
    } catch {
      // Factory not configured — skip
    }

    // Index all known pool + fund manager contracts
    const poolRows = await this.pools.find();
    for (const p of poolRows) {
      addresses.add(p.contractAddress.toLowerCase());
      addresses.add(p.fundManagerAddress.toLowerCase());
    }

    for (const addr of addresses) {
      if (!addr || addr === 'undefined' || addr === 'null') continue;
      await this.indexContract(addr);
    }
  }

  // ─── Per-Contract Indexing ─────────────────────────────────

  private async indexContract(contractAddress: string) {
    const state = await this.getState(contractAddress);
    const provider = this.contracts.getProvider();
    const fromBlock = Number(state.lastBlockNumber) + 1;

    let latestBlock: number;
    try {
      latestBlock = await provider.getBlockNumber();
    } catch (e) {
      this.logger.warn(`Failed to get block number: ${e}`);
      return;
    }

    if (fromBlock > latestBlock) return;

    // Limit to 2000 blocks per poll to avoid RPC timeouts
    const toBlock = Math.min(fromBlock + 2000, latestBlock);

    try {
      let logs: any[] = [];
      let retries = 3;
      while (retries > 0) {
        try {
          logs = await provider.getLogs({
            address: contractAddress,
            fromBlock,
            toBlock,
          });
          break;
        } catch (e: any) {
          retries--;
          if (retries === 0) throw e;
          this.logger.warn(`RPC error getting logs for ${contractAddress}, retrying... (${retries} left)`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      for (const log of logs) {
        await this.processLog(contractAddress, log);
      }

      state.lastBlockNumber = String(toBlock);
      await this.indexerState.save(state);
      this.events.emitIndexerSync({
        contractId: contractAddress,
        processed: logs.length,
        fromBlock,
        toBlock,
      });
    } catch (e) {
      this.logger.warn(`getLogs final failure for ${contractAddress}: ${e}`);
    }
  }

  // ─── Log Processing ────────────────────────────────────────

  private async processLog(
    contractAddress: string,
    log: { topics: readonly string[]; data: string; transactionHash: string; blockNumber: number },
  ) {
    const txHash = log.transactionHash;
    const blockNumber = log.blockNumber;
    const topics = [...log.topics];

    // Try Factory events
    const factoryEvent = this.contracts.parseLog(POOL_FACTORY_ABI, {
      topics,
      data: log.data,
    });
    if (factoryEvent?.name === 'PoolCreated') {
      await this.handlePoolCreated(txHash, blockNumber, factoryEvent);
      return;
    }

    // Try Pool events
    const poolEvent = this.contracts.parseLog(LENDING_POOL_ABI, {
      topics,
      data: log.data,
    });
    if (poolEvent) {
      switch (poolEvent.name) {
        case 'Deposit':
          await this.handleDeposit(contractAddress, txHash, blockNumber, poolEvent);
          return;
        case 'Withdraw':
          await this.handleWithdraw(contractAddress, txHash, blockNumber, poolEvent);
          return;
        case 'AssetUnderManagementUpdated':
          await this.handleAum(contractAddress, txHash, blockNumber, poolEvent);
          return;
        case 'PoolStatusUpdated':
          await this.handlePoolStatus(contractAddress, poolEvent);
          return;
      }
    }

    // Try FundManager events
    const fmEvent = this.contracts.parseLog(ASSET_MANAGER_ABI, {
      topics,
      data: log.data,
    });
    if (fmEvent?.name === 'V1PoolAdded') {
      await this.handleV1PoolAdded(contractAddress, fmEvent);
    }
  }

  // ─── Event Handlers ────────────────────────────────────────

  private async handlePoolCreated(
    txHash: string,
    blockNumber: number,
    parsed: { args: Record<string, unknown> },
  ) {
    const poolAddr = String(parsed.args._pool).toLowerCase();
    const fmAddr = String(parsed.args._fundManager).toLowerCase();
    const apy = Number(parsed.args._poolAPY ?? 0);
    const size = String(parsed.args._poolSize ?? '0');

    // Skip if already indexed
    const existing = await this.pools.findOne({
      where: { contractAddress: poolAddr },
    });
    if (existing) return;

    // Try to correlate with a draft by txHash
    const drafts = await this.drafts
      .createQueryBuilder('d')
      .where('d.indexed = false')
      .andWhere('d.txHash IS NOT NULL')
      .getMany();
    const match = drafts.find(
      (d) => d.txHash && d.txHash.toLowerCase() === txHash.toLowerCase(),
    );

    const pool = this.pools.create({
      contractAddress: poolAddr,
      fundManagerAddress: fmAddr,
      name: match?.name ?? 'Pool',
      symbol: match?.symbol ?? 'OY',
      status: 'pending',
      poolTokenAddress: match?.poolTokenAddress ?? '',
      lpTokenAddress: poolAddr,
      apyBasisPoints: match?.apyBasisPoints ?? apy,
      poolSize: match?.poolSize ?? size,
      assetUnderManagement: '0',
      borrowerAddress: match?.borrowerAddress ?? '',
      feeCollectorAddress: match?.feeCollectorAddress ?? '',
      poolManagerAddress: match?.poolManagerAddress ?? null,
      oracleManagerAddress: match?.oracleManagerAddress ?? null,
    });
    await this.pools.save(pool);

    if (match) {
      match.indexed = true;
      await this.drafts.save(match);
    }

    // Register contracts
    await this.registry.save([
      { type: 'pool' as const, address: poolAddr, implementationAddress: null, deployedAt: new Date(), version: 1 },
      { type: 'fund_manager' as const, address: fmAddr, implementationAddress: null, deployedAt: new Date(), version: 1 },
    ]);

    await this.getState(poolAddr, String(blockNumber));
    await this.getState(fmAddr, String(blockNumber));

    await this.saveTx(txHash, 'create_pool', poolAddr, 'confirmed', undefined, blockNumber);
  }

  private async handleDeposit(
    poolContract: string,
    txHash: string,
    blockNumber: number,
    parsed: { args: Record<string, unknown> },
  ) {
    const owner = String(parsed.args.owner).toLowerCase();
    const assets = String(parsed.args.assets ?? '0');
    const shares = String(parsed.args.shares ?? '0');

    const pool = await this.pools.findOne({
      where: { contractAddress: poolContract },
    });
    if (!pool) return;

    let pos = await this.positions.findOne({
      where: { poolId: pool.id, lenderAddress: owner },
    });
    if (!pos) {
      pos = this.positions.create({
        poolId: pool.id,
        lenderAddress: owner,
        lpTokenBalance: '0',
        depositedAmount: '0',
        currentValue: '0',
        yieldEarned: '0',
        firstDepositAt: new Date(),
      });
    }
    pos.lpTokenBalance = (BigInt(pos.lpTokenBalance) + BigInt(shares)).toString();
    pos.depositedAmount = (BigInt(pos.depositedAmount) + BigInt(assets)).toString();
    pos.currentValue = (BigInt(pos.currentValue) + BigInt(assets)).toString();
    pos.lastUpdatedAt = new Date();
    await this.positions.save(pos);

    await this.saveTx(txHash, 'deposit', poolContract, 'confirmed', assets, blockNumber);
  }

  private async handleWithdraw(
    poolContract: string,
    txHash: string,
    blockNumber: number,
    parsed: { args: Record<string, unknown> },
  ) {
    const owner = String(parsed.args.owner).toLowerCase();
    const assets = String(parsed.args.assets ?? '0');
    const shares = String(parsed.args.shares ?? '0');

    const pool = await this.pools.findOne({
      where: { contractAddress: poolContract },
    });
    if (!pool) return;

    const pos = await this.positions.findOne({
      where: { poolId: pool.id, lenderAddress: owner },
    });
    if (pos) {
      pos.lpTokenBalance = (BigInt(pos.lpTokenBalance) - BigInt(shares)).toString();
      pos.currentValue = (BigInt(pos.currentValue) - BigInt(assets)).toString();
      pos.lastUpdatedAt = new Date();
      await this.positions.save(pos);
    }

    await this.saveTx(txHash, 'withdraw', poolContract, 'confirmed', assets, blockNumber);
  }

  private async handleAum(
    poolContract: string,
    txHash: string,
    blockNumber: number,
    parsed: { args: Record<string, unknown> },
  ) {
    const newVal = String(parsed.args._newValue ?? '0');
    const pool = await this.pools.findOne({
      where: { contractAddress: poolContract },
    });
    if (!pool) return;

    pool.assetUnderManagement = newVal;
    await this.pools.save(pool);

    await this.aumHistory.save({
      poolAddress: poolContract,
      aum: newVal,
      source: 'oracle' as const,
      recordedAt: new Date(),
    });

    await this.saveTx(txHash, 'aum_update', poolContract, 'confirmed', undefined, blockNumber);
  }

  private async handlePoolStatus(
    poolContract: string,
    parsed: { args: Record<string, unknown> },
  ) {
    const pool = await this.pools.findOne({
      where: { contractAddress: poolContract },
    });
    if (!pool) return;

    const statusMap: PoolEntity['status'][] = ['pending', 'active', 'closed'];
    const st = Number(parsed.args._newStatus);
    pool.status = statusMap[st] ?? pool.status;
    await this.pools.save(pool);
  }

  private async handleV1PoolAdded(
    fundManagerContract: string,
    parsed: { args: Record<string, unknown> },
  ) {
    const pool = await this.pools.findOne({
      where: { fundManagerAddress: fundManagerContract },
    });
    if (!pool) return;

    const walletAddr = String(parsed.args.wallet).toLowerCase();
    const row = this.borrowerPools.create({
      poolId: pool.id,
      fundManagerAddress: fundManagerContract,
      v1PoolId: String(parsed.args._v1PoolId),
      allocationBps: Number(parsed.args._allocation),
      dedicatedWalletAddress: walletAddr,
    });
    await this.borrowerPools.save(row);
  }

  // ─── Helpers ───────────────────────────────────────────────

  private async ensureFactoryRegistry() {
    try {
      const factoryAddr = this.contracts.factoryAddress();
      const exists = await this.registry.findOne({
        where: { address: factoryAddr.toLowerCase() },
      });
      if (!exists) {
        await this.registry.save({
          type: 'factory' as const,
          address: factoryAddr.toLowerCase(),
          implementationAddress: null,
          deployedAt: new Date(),
          version: 1,
        });
      }
    } catch {
      // Factory not configured
    }
  }

  private async getState(contract: string, defaultBlock?: string): Promise<IndexerStateEntity> {
    let s = await this.indexerState.findOne({
      where: { contractAddress: contract },
    });
    if (!s) {
      let initialBlock = defaultBlock;
      if (!initialBlock) {
        try {
          const factory = this.contracts.factoryAddress().toLowerCase();
          if (contract.toLowerCase() === factory) {
            initialBlock = this.config.get<string>('indexer.startBlock') ?? '0';
          } else {
            initialBlock = '0';
          }
        } catch {
          initialBlock = '0';
        }
      }

      s = this.indexerState.create({
        contractAddress: contract,
        lastBlockNumber: initialBlock,
      });
      await this.indexerState.save(s);
    }
    return s;
  }

  private async saveTx(
    txHash: string,
    type: TransactionRecordEntity['type'],
    poolAddress: string,
    status: TransactionRecordEntity['status'],
    amount?: string,
    blockNumber?: number,
  ) {
    if (!txHash) return;
    const exists = await this.txs.findOne({ where: { txHash } });
    if (exists) {
      // Update an existing pending record to confirmed (or whatever status the indexer found)
      if (exists.status !== status) {
        exists.status = status;
        exists.confirmedAt = new Date();
        if (amount && (!exists.amount || exists.amount === '0')) {
          exists.amount = amount;
        }
        if (blockNumber != null && !exists.blockNumber) {
          exists.blockNumber = String(blockNumber);
        }
        await this.txs.save(exists);
      }
      return;
    }
    await this.txs.save({
      txHash,
      type,
      poolAddress,
      status,
      amount: amount ?? null,
      fromAddress: null,
      toAddress: null,
      tokenAddress: null,
      feeAmount: null,
      blockNumber: blockNumber != null ? String(blockNumber) : null,
      confirmedAt: new Date(),
    });
  }
}
