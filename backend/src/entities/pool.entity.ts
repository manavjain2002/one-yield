import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { BorrowerPoolEntity } from './borrower-pool.entity';
import { LenderPositionEntity } from './lender-position.entity';

export type PoolStatus = 'pending' | 'active' | 'paused' | 'closed';
export type RiskLevel = 'low' | 'medium' | 'high';

@Entity('pools')
export class PoolEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  contractAddress: string;

  @Column()
  fundManagerAddress: string;

  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column({ type: 'varchar', length: 32 })
  status: PoolStatus;

  @Column()
  poolTokenAddress: string;

  @Column({ nullable: true })
  lpTokenAddress: string | null;

  @Column({ type: 'int' })
  apyBasisPoints: number;

  @Column({ type: 'bigint', default: '0' })
  poolSize: string;

  @Column({ type: 'bigint', default: '0' })
  assetUnderManagement: string;

  @Column({ type: 'int', default: 9500 })
  nonReservePercentage: number;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  riskLevel: RiskLevel;

  @Column()
  borrowerAddress: string;

  @Column()
  feeCollectorAddress: string;

  @Column({ nullable: true })
  poolManagerAddress: string | null;

  @Column({ nullable: true })
  oracleManagerAddress: string | null;

  @Column({ type: 'bigint', default: '0' })
  minimumInvestmentLimit: string;

  @Column({ type: 'bigint', default: '0' })
  pauseStartTime: string;

  @Column({ type: 'bigint', default: '1800' })
  pauseDuration: string;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => BorrowerPoolEntity, (b) => b.pool)
  borrowerPools: BorrowerPoolEntity[];

  @OneToMany(() => LenderPositionEntity, (p) => p.pool)
  lenderPositions: LenderPositionEntity[];
}
