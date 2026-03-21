import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('indexer_state')
export class IndexerStateEntity {
  @PrimaryColumn()
  contractAddress: string;

  @Column({ type: 'bigint', default: '0' })
  lastBlockNumber: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
