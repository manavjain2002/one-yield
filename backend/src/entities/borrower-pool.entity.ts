import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PoolEntity } from './pool.entity';

@Entity('borrower_pools')
export class BorrowerPoolEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fundManagerAddress: string;

  @Column()
  v1PoolId: string;

  @Column({ type: 'smallint' })
  allocationBps: number;

  @Column()
  dedicatedWalletAddress: string;

  @Column({ type: 'bigint', default: '0' })
  fundsDeployed: string;

  @Column({ type: 'bigint', default: '0' })
  fundsRepaid: string;

  @ManyToOne(() => PoolEntity, (p) => p.borrowerPools, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poolId' })
  pool: PoolEntity;

  @Column({ type: 'uuid' })
  poolId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
