import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppUserRole = 'borrower' | 'lender' | 'manager';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Native Hedera `0.0.x` when known (optional for pure MetaMask users). */
  @Column({ unique: true, nullable: true })
  hederaAccountId: string | null;

  /** Lowercase `0x…` EVM address for MetaMask / Hedera EVM login. */
  @Column({ unique: true, nullable: true })
  evmAddress: string | null;

  @Column({ type: 'varchar', length: 16 })
  role: AppUserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
