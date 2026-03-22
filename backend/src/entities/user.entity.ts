import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppUserRole = 'borrower' | 'lender' | 'manager' | 'admin';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Lowercase `0x…` EVM address for MetaMask login. Nullable for Admin/Borrower. */
  @Column({ unique: true, nullable: true })
  walletAddress: string;

  /** Username for Admin/Borrower login. */
  @Column({ unique: true, nullable: true })
  username: string;

  /** Hashed password for Admin/Borrower login. */
  @Column({ nullable: true })
  passwordHash: string;

  @Column({ type: 'varchar', length: 16 })
  role: AppUserRole;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  country: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
