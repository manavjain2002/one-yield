import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ContractType =
  | 'factory'
  | 'pool'
  | 'fund_manager'
  | 'withdrawal_manager';

@Entity('contract_registry')
export class ContractRegistryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  type: ContractType;

  @Column({ unique: true })
  address: string;

  @Column({ nullable: true })
  implementationAddress: string | null;

  @Column({ type: 'timestamp' })
  deployedAt: Date;

  @Column({ type: 'int', default: 1 })
  version: number;
}
