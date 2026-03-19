import { Injectable } from '@nestjs/common';
import { Interface } from 'ethers';
import {
  FACTORY_ABI,
  FUND_MANAGER_ABI,
  POOL_ABI,
} from '../contracts/abi-fragments';
import { hederaIdToEvmAddress } from './hedera-address.util';

@Injectable()
export class ContractEncodeService {
  private factory = new Interface([...FACTORY_ABI]);
  private pool = new Interface([...POOL_ABI]);
  private fm = new Interface([...FUND_MANAGER_ABI]);

  encodeCreatePool(params: {
    poolName: string;
    poolSymbol: string;
    poolManager: string;
    poolToken: string;
    oracleManager: string;
    feeCollector: string;
    projectedApy: bigint;
    poolSize: bigint;
  }): Uint8Array {
    const data = this.factory.encodeFunctionData('createPool', [
      params.poolName,
      params.poolSymbol,
      hederaIdToEvmAddress(params.poolManager),
      hederaIdToEvmAddress(params.poolToken),
      hederaIdToEvmAddress(params.oracleManager),
      hederaIdToEvmAddress(params.feeCollector),
      params.projectedApy,
      params.poolSize,
    ]);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeActivatePool(): Uint8Array {
    const data = this.pool.encodeFunctionData('activatePool', []);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodePause(): Uint8Array {
    const data = this.pool.encodeFunctionData('pause', []);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeUnpause(): Uint8Array {
    const data = this.pool.encodeFunctionData('unpause', []);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeUpdateAssetUnderManagement(aum: bigint): Uint8Array {
    const data = this.pool.encodeFunctionData('updateAssetUnderManagement', [
      aum,
    ]);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeSendReserveToFundManager(amount: bigint): Uint8Array {
    const data = this.pool.encodeFunctionData('sendReserveToFundManager', [
      amount,
    ]);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeAddPool(
    v1PoolId: string,
    allocationBps: number,
    dedicatedWallet: string,
  ): Uint8Array {
    const data = this.fm.encodeFunctionData('addPool', [
      v1PoolId,
      allocationBps,
      hederaIdToEvmAddress(dedicatedWallet),
    ]);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeDeployFunds(): Uint8Array {
    const data = this.fm.encodeFunctionData('deployFunds', []);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodePay(v1PoolId: string, amount: bigint, fee: bigint): Uint8Array {
    const data = this.fm.encodeFunctionData('pay', [v1PoolId, amount, fee]);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeSendToV2Reserve(
    v2Amount: bigint,
    uptoQueuePosition: bigint,
  ): Uint8Array {
    const data = this.fm.encodeFunctionData('sendToV2Reserve', [
      v2Amount,
      uptoQueuePosition,
    ]);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeFactoryPauseTarget(targetContract: string): Uint8Array {
    const data = this.factory.encodeFunctionData('pauseTarget', [
      hederaIdToEvmAddress(targetContract),
    ]);
    return Buffer.from(data.slice(2), 'hex');
  }

  encodeFactoryUnpauseTarget(targetContract: string): Uint8Array {
    const data = this.factory.encodeFunctionData('unpauseTarget', [
      hederaIdToEvmAddress(targetContract),
    ]);
    return Buffer.from(data.slice(2), 'hex');
  }

  decodePoolCreated(log: { topics: string[]; data: string }) {
    try {
      return this.factory.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }

  decodeDeposit(log: { topics: string[]; data: string }) {
    try {
      return this.pool.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }

  decodeWithdraw(log: { topics: string[]; data: string }) {
    try {
      return this.pool.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }

  decodeAssetUnderManagement(log: { topics: string[]; data: string }) {
    try {
      return this.pool.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }

  decodePoolStatusUpdated(log: { topics: string[]; data: string }) {
    try {
      return this.pool.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }

  decodeFundDeployed(log: { topics: string[]; data: string }) {
    try {
      return this.fm.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }

  decodeFundDeployedToChild(log: { topics: string[]; data: string }) {
    try {
      return this.fm.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }

  decodeFundsPaid(log: { topics: string[]; data: string }) {
    try {
      return this.fm.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }

  decodeV1PoolAdded(log: { topics: string[]; data: string }) {
    try {
      return this.fm.parseLog({
        topics: log.topics,
        data: log.data,
      });
    } catch {
      return null;
    }
  }
}
