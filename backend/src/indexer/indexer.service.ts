import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContractEncodeService } from '../blockchain/contract-encode.service';
import { PoolEntity } from '../entities/pool.entity';
import { PoolDraftEntity } from '../entities/pool-draft.entity';
import { ContractRegistryEntity } from '../entities/contract-registry.entity';
import { IndexerStateEntity } from '../entities/indexer-state.entity';
import { TransactionRecordEntity } from '../entities/transaction-record.entity';
import { LenderPositionEntity } from '../entities/lender-position.entity';
import { AumHistoryEntity } from '../entities/aum-history.entity';
import { BorrowerPoolEntity } from '../entities/borrower-pool.entity';
import { EventsGateway } from '../websocket/events.gateway';
import { evmAddressToContractId, topicToEvmAddress } from './evm-topic.util';

interface MirrorLog {
  transaction_id?: string;
  consensus_timestamp?: string;
  data: string;
  topics?: string[];
  contract_id?: string;
}

interface MirrorLogsResponse {
  logs?: MirrorLog[];
  links?: { next?: string };
}

function normalizeTxId(a: string, b: string): boolean {
  return a.replace(/\s/g, '') === b.replace(/\s/g, '');
}

@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private pollRunning = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly encode: ContractEncodeService,
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

  private mirrorBase(): string {
    return (
      this.config.get<string>('hedera.mirrorNodeUrl') ??
      'https://testnet.mirrornode.hedera.com'
    );
  }

  private async ensureFactoryRegistry() {
    const factoryId = this.config.get<string>('hedera.factoryContractId');
    if (!factoryId || factoryId === '0.0.0') return;
    const exists = await this.registry.findOne({
      where: { address: factoryId },
    });
    if (!exists) {
      await this.registry.save({
        type: 'factory',
        address: factoryId,
        implementationAddress: null,
        deployedAt: new Date(),
        version: 1,
      });
    }
  }

  async poll() {
    await this.ensureFactoryRegistry();
    const factoryId = this.config.get<string>('hedera.factoryContractId');
    const addresses = new Set<string>();
    if (factoryId && factoryId !== '0.0.0') addresses.add(factoryId);
    const poolRows = await this.pools.find();
    for (const p of poolRows) {
      addresses.add(p.contractAddress);
      addresses.add(p.fundManagerAddress);
    }
    for (const addr of addresses) {
      await this.indexContract(addr);
    }
  }

  private async getState(contract: string): Promise<IndexerStateEntity> {
    let s = await this.indexerState.findOne({
      where: { contractAddress: contract },
    });
    if (!s) {
      s = this.indexerState.create({
        contractAddress: contract,
        lastConsensusTimestamp: '0',
      });
      await this.indexerState.save(s);
    }
    return s;
  }

  private async indexContract(contractId: string) {
    const state = await this.getState(contractId);
    const base = this.mirrorBase();
    const ts = state.lastConsensusTimestamp || '0';
    const url = `${base}/api/v1/contracts/${contractId}/results/logs?order=asc&limit=100&timestamp=gte:${ts}`;
    const res = await fetch(url);
    if (!res.ok) {
      this.logger.warn(`Mirror logs ${contractId}: ${res.status}`);
      return;
    }
    const body = (await res.json()) as MirrorLogsResponse;
    const logs = body.logs ?? [];
    let maxTs = ts;
    for (const log of logs) {
      if (log.consensus_timestamp && log.consensus_timestamp > maxTs) {
        maxTs = log.consensus_timestamp;
      }
      await this.processLog(contractId, log);
    }
    if (maxTs !== ts) {
      state.lastConsensusTimestamp = maxTs;
      await this.indexerState.save(state);
    }
    this.events.emitIndexerSync({ contractId, processed: logs.length });
  }

  private normalizeTopics(topics: string[] | undefined): string[] {
    if (!topics?.length) return [];
    return topics.map((t) => (t.startsWith('0x') ? t : `0x${t}`));
  }

  private async processLog(contractId: string, log: MirrorLog) {
    const topics = this.normalizeTopics(log.topics);
    const data = log.data?.startsWith('0x') ? log.data : `0x${log.data ?? ''}`;
    const txId = log.transaction_id ?? 'unknown';
    const parsedFactory = this.encode.decodePoolCreated({ topics, data });
    if (parsedFactory?.name === 'PoolCreated') {
      await this.handlePoolCreated(log, parsedFactory as any);
      return;
    }
    const parsedDeposit = this.encode.decodeDeposit({ topics, data });
    if (parsedDeposit?.name === 'Deposit') {
      await this.handleDeposit(contractId, txId, parsedDeposit as any);
      return;
    }
    const parsedWithdraw = this.encode.decodeWithdraw({ topics, data });
    if (parsedWithdraw?.name === 'Withdraw') {
      await this.handleWithdraw(contractId, txId, parsedWithdraw as any);
      return;
    }
    const parsedAum = this.encode.decodeAssetUnderManagement({
      topics,
      data,
    });
    if (parsedAum?.name === 'AssetUnderManagementUpdated') {
      await this.handleAum(contractId, txId, parsedAum as any);
      return;
    }
    const parsedStatus = this.encode.decodePoolStatusUpdated({
      topics,
      data,
    });
    if (parsedStatus?.name === 'PoolStatusUpdated') {
      await this.handlePoolStatus(contractId, parsedStatus as any);
      return;
    }
    const parsedV1 = this.encode.decodeV1PoolAdded({ topics, data });
    if (parsedV1?.name === 'V1PoolAdded') {
      await this.handleV1PoolAdded(contractId, parsedV1 as any);
      return;
    }
  }

  private async handlePoolCreated(
    log: MirrorLog,
    parsed: { args: { _pool: string; _fundManager: string; _poolAPY: bigint; _poolSize: bigint } },
  ) {
    const txId = log.transaction_id ?? '';
    const poolEvm =
      typeof parsed.args._pool === 'string'
        ? parsed.args._pool
        : (parsed.args as unknown as { _pool: string })._pool;
    const fmEvm =
      typeof parsed.args._fundManager === 'string'
        ? parsed.args._fundManager
        : (parsed.args as unknown as { _fundManager: string })._fundManager;
    const poolAddr = evmAddressToContractId(
      poolEvm.startsWith('0x') ? poolEvm : `0x${poolEvm}`,
    );
    const fmAddr = evmAddressToContractId(
      fmEvm.startsWith('0x') ? fmEvm : `0x${fmEvm}`,
    );
    const existing = await this.pools.findOne({
      where: { contractAddress: poolAddr },
    });
    if (existing) return;

    const draft = await this.drafts
      .createQueryBuilder('d')
      .where('d.indexed = false')
      .andWhere('d.hederaTransactionId IS NOT NULL')
      .getMany();
    const match = draft.find(
      (d) =>
        d.hederaTransactionId &&
        txId &&
        normalizeTxId(d.hederaTransactionId, txId),
    );

    const apy = Number(parsed.args._poolAPY ?? 0n);
    const size = (parsed.args._poolSize ?? 0n).toString();

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
    await this.registry.save([
      {
        type: 'pool',
        address: poolAddr,
        implementationAddress: null,
        deployedAt: new Date(),
        version: 1,
      },
      {
        type: 'fund_manager',
        address: fmAddr,
        implementationAddress: null,
        deployedAt: new Date(),
        version: 1,
      },
    ]);
    await this.saveTx(txId, 'create_pool', poolAddr, 'confirmed');
  }

  private async handleDeposit(
    poolContract: string,
    txId: string,
    parsed: { args: { owner: string; assets: bigint; shares: bigint } },
  ) {
    const ownerTopic = parsed.args.owner;
    const owner =
      typeof ownerTopic === 'string' && ownerTopic.startsWith('0x')
        ? ownerTopic
        : topicToEvmAddress(String(ownerTopic));
    const ownerId = evmAddressToContractId(owner);
    const pool = await this.pools.findOne({
      where: { contractAddress: poolContract },
    });
    if (!pool) return;
    const assets = (parsed.args.assets ?? 0n).toString();
    const shares = (parsed.args.shares ?? 0n).toString();
    let pos = await this.positions.findOne({
      where: { poolId: pool.id, lenderAddress: ownerId },
    });
    if (!pos) {
      pos = this.positions.create({
        poolId: pool.id,
        lenderAddress: ownerId,
        lpTokenBalance: '0',
        depositedAmount: '0',
        currentValue: '0',
        yieldEarned: '0',
        firstDepositAt: new Date(),
      });
    }
    pos.lpTokenBalance = (
      BigInt(pos.lpTokenBalance) + BigInt(shares)
    ).toString();
    pos.depositedAmount = (
      BigInt(pos.depositedAmount) + BigInt(assets)
    ).toString();
    pos.currentValue = (
      BigInt(pos.currentValue) + BigInt(assets)
    ).toString();
    pos.lastUpdatedAt = new Date();
    await this.positions.save(pos);
    await this.saveTx(txId, 'deposit', poolContract, 'confirmed', assets);
  }

  private async handleWithdraw(
    poolContract: string,
    txId: string,
    parsed: { args: { owner: string; assets: bigint; shares: bigint } },
  ) {
    const ownerRaw = parsed.args.owner;
    const owner =
      typeof ownerRaw === 'string' && ownerRaw.startsWith('0x')
        ? ownerRaw
        : topicToEvmAddress(String(ownerRaw));
    const ownerId = evmAddressToContractId(owner);
    const pool = await this.pools.findOne({
      where: { contractAddress: poolContract },
    });
    if (!pool) return;
    const assets = (parsed.args.assets ?? 0n).toString();
    const shares = (parsed.args.shares ?? 0n).toString();
    const pos = await this.positions.findOne({
      where: { poolId: pool.id, lenderAddress: ownerId },
    });
    if (pos) {
      pos.lpTokenBalance = (
        BigInt(pos.lpTokenBalance) - BigInt(shares)
      ).toString();
      pos.currentValue = (
        BigInt(pos.currentValue) - BigInt(assets)
      ).toString();
      pos.lastUpdatedAt = new Date();
      await this.positions.save(pos);
    }
    await this.saveTx(txId, 'withdraw', poolContract, 'confirmed', assets);
  }

  private async handleAum(
    poolContract: string,
    txId: string,
    parsed: { args: { _newValue: bigint } },
  ) {
    const pool = await this.pools.findOne({
      where: { contractAddress: poolContract },
    });
    if (!pool) return;
    const newVal = (parsed.args._newValue ?? 0n).toString();
    pool.assetUnderManagement = newVal;
    await this.pools.save(pool);
    await this.aumHistory.save({
      poolAddress: poolContract,
      aum: newVal,
      source: 'oracle',
      recordedAt: new Date(),
    });
    await this.saveTx(txId, 'aum_update', poolContract, 'confirmed');
  }

  private async handlePoolStatus(
    poolContract: string,
    parsed: { args: { _newStatus: number } },
  ) {
    const pool = await this.pools.findOne({
      where: { contractAddress: poolContract },
    });
    if (!pool) return;
    const st = Number(parsed.args._newStatus);
    const map: PoolEntity['status'][] = [
      'pending',
      'active',
      'closed',
    ];
    pool.status = map[st] ?? pool.status;
    await this.pools.save(pool);
  }

  private async handleV1PoolAdded(
    fundManagerContract: string,
    parsed: {
      args: { _v1PoolId: string; _allocation: number; wallet: string };
    },
  ) {
    const pool = await this.pools.findOne({
      where: { fundManagerAddress: fundManagerContract },
    });
    if (!pool) return;
    const w = parsed.args.wallet;
    const walletAddr = evmAddressToContractId(
      typeof w === 'string' && w.startsWith('0x') ? w : `0x${String(w).slice(-40)}`,
    );
    const row = this.borrowerPools.create({
      poolId: pool.id,
      fundManagerAddress: fundManagerContract,
      v1PoolId: String(parsed.args._v1PoolId),
      allocationBps: Number(parsed.args._allocation),
      dedicatedWalletAddress: walletAddr,
    });
    await this.borrowerPools.save(row);
  }

  private async saveTx(
    txId: string,
    type: TransactionRecordEntity['type'],
    poolAddress: string,
    status: TransactionRecordEntity['status'],
    amount?: string,
  ) {
    if (!txId || txId === 'unknown') return;
    const exists = await this.txs.findOne({ where: { txHash: txId } });
    if (exists) return;
    await this.txs.save({
      txHash: txId,
      type,
      poolAddress,
      status,
      amount: amount ?? null,
      fromAddress: null,
      toAddress: null,
      tokenAddress: null,
      feeAmount: null,
      consensusTimestamp: null,
      confirmedAt: new Date(),
    });
  }
}
