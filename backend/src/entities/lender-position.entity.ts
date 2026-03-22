import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { PoolEntity } from './pool.entity';

@Entity('lender_positions')
export class LenderPositionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  lenderAddress: string;

  @ManyToOne(() => PoolEntity, (p) => p.lenderPositions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poolId' })
  pool: PoolEntity;

  @Column({ type: 'uuid' })
  poolId: string;

  @Column({ type: 'bigint', default: '0' })
  lpTokenBalance: string;

  @Column({ type: 'bigint', default: '0' })
  depositedAmount: string;

  @Column({ type: 'bigint', default: '0' })
  withdrawnAmount: string;

  @Column({ type: 'bigint', default: '0' })
  currentValue: string;

  @Column({ type: 'bigint', default: '0' })
  yieldEarned: string;

  @Column({ type: 'timestamp', nullable: true })
  firstDepositAt: Date | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUpdatedAt: Date;
}
