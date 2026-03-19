import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TxType =
  | 'deposit'
  | 'withdraw'
  | 'deploy_funds'
  | 'repay'
  | 'send_to_reserve'
  | 'activate'
  | 'pause'
  | 'create_pool'
  | 'aum_update'
  | 'transfer'
  | 'borrow'
  | 'other';

export type TxStatus = 'pending' | 'confirmed' | 'failed';

@Entity('transactions')
export class TransactionRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  txHash: string;

  @Column({ type: 'varchar', length: 32 })
  type: TxType;

  @Column({ nullable: true })
  poolAddress: string | null;

  @Column({ nullable: true })
  fromAddress: string | null;

  @Column({ nullable: true })
  toAddress: string | null;

  @Column({ type: 'bigint', nullable: true })
  amount: string | null;

  @Column({ nullable: true })
  tokenAddress: string | null;

  @Column({ type: 'bigint', nullable: true })
  feeAmount: string | null;

  @Column({ type: 'varchar', length: 16 })
  status: TxStatus;

  @Column({ type: 'bigint', nullable: true })
  consensusTimestamp: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;
}
