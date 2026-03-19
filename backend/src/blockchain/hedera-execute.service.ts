import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  Hbar,
  HbarUnit,
  TransactionId,
  TransactionReceiptQuery,
  TransactionResponse,
} from '@hashgraph/sdk';
import { SignerService } from './signer.service';

export interface ExecuteResult {
  transactionId: string;
  txHash: string;
  status: string;
}

@Injectable()
export class HederaExecuteService {
  private readonly logger = new Logger(HederaExecuteService.name);
  private client: Client;

  constructor(
    private readonly config: ConfigService,
    private readonly signers: SignerService,
  ) {
    const network = this.config.get<string>('hedera.network') ?? 'testnet';
    this.client =
      network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  }

  private async resolveExecutableContractId(
    contractIdStr: string,
  ): Promise<ContractId> {
    const raw = contractIdStr.trim();
    let contract: ContractId;
    if (this.isEvmContractAddress(raw)) {
      contract = ContractId.fromEvmAddress(0, 0, raw);
    } else {
      contract = ContractId.fromString(raw);
    }
    if (contract.evmAddress != null && contract.num.isZero()) {
      contract = await contract.populateAccountNum(this.client);
    }
    return contract;
  }

  private isEvmContractAddress(s: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(s);
  }

  async executeContract(params: {
    walletKey: string;
    contractId: string;
    functionParameters: Uint8Array;
    gas?: number;
    maxHbar?: number;
  }): Promise<ExecuteResult> {
    const { accountId, privateKey } = this.signers.getSigner(params.walletKey);
    console.log('accountId', accountId);
    console.log('privateKey', privateKey);
    const contract = await this.resolveExecutableContractId(params.contractId);
    console.log('contract', contract);
    const gas = params.gas ?? 800_000;
    const maxHbar = params.maxHbar ?? 5;

    const tx = await new ContractExecuteTransaction()
      .setContractId(contract)
      .setGas(gas)
      .setFunctionParameters(params.functionParameters)
      .setMaxTransactionFee(Hbar.from(maxHbar, HbarUnit.Hbar))
      .setTransactionId(TransactionId.generate(accountId))
      .freezeWith(this.client);

    const signed = await tx.sign(privateKey);
    const response: TransactionResponse = await signed.execute(this.client);
    const receipt = await new TransactionReceiptQuery()
      .setTransactionId(response.transactionId)
      .execute(this.client);

    const status = receipt.status.toString();
    if (!receipt.status.toString().includes('SUCCESS')) {
      this.logger.warn(`Contract exec status: ${status}`);
    }

    const txHash = this.formatTxId(response.transactionId.toString());
    return {
      transactionId: response.transactionId.toString(),
      txHash,
      status,
    };
  }

  /** Hedera transaction id to explorer-style hash fragment */
  private formatTxId(tid: string): string {
    return tid.replace('@', '-').replace(/\./g, '-');
  }

  getMirrorBaseUrl(): string {
    return (
      this.config.get<string>('hedera.mirrorNodeUrl') ??
      'https://testnet.mirrornode.hedera.com'
    );
  }
}
