import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Links an in-flight createPool tx to borrower-supplied metadata until indexer confirms. */
@Entity('pool_drafts')
export class PoolDraftEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  borrowerAddress: string;

  @Column({ nullable: true })
  hederaTransactionId: string | null;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column({ type: 'int' })
  apyBasisPoints: number;

  @Column({ type: 'bigint' })
  poolSize: string;

  @Column()
  poolTokenAddress: string;

  @Column()
  poolManagerAddress: string;

  @Column()
  oracleManagerAddress: string;

  @Column()
  feeCollectorAddress: string;

  @Column({ default: false })
  indexed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
