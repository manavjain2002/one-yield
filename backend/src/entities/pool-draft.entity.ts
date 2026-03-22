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

  @Column({ name: 'borrower_identifier' })
  borrowerIdentifier: string;

  @Column({ nullable: true })
  txHash: string | null;

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

  /** Relative path under UPLOAD_DIR (e.g. pool-drafts/uuid.pdf) */
  @Column({ nullable: true })
  documentPath: string | null;

  @Column({ nullable: true })
  documentOriginalName: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
