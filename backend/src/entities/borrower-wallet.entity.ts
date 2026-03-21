import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('borrower_wallets')
export class BorrowerWalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The identifier for the borrower, could be username or wallet */
  @Column()
  borrowerIdentifier: string;

  /** The physical wallet address the borrower will use */
  @Column()
  walletAddress: string;

  /** The accepted token for this wallet (address or symbol, backend maps it) */
  @Column()
  tokenAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
