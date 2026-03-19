import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type QueueJobStatus =
  | 'pending'
  | 'processing'
  | 'done'
  | 'failed';

@Entity('queue_jobs')
export class QueueJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  jobId: string;

  @Column()
  walletKey: string;

  @Column()
  contractAddress: string;

  @Column()
  functionName: string;

  @Column({ type: 'varchar', length: 16 })
  status: QueueJobStatus;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'text', nullable: true })
  txHash: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date | null;
}
