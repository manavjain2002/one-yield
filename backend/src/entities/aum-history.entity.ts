import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AumSource = 'oracle' | 'fund_manager' | 'emergency';

@Entity('aum_history')
export class AumHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  poolAddress: string;

  @Column({ type: 'bigint' })
  aum: string;

  @Column({ type: 'varchar', length: 24 })
  source: AumSource;

  @Column({ type: 'timestamp' })
  recordedAt: Date;
}
