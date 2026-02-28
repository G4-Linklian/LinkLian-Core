// user-sys.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Enum for user status
 */
export enum UserStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PENDING = 'Pending',
  SUSPENDED = 'Suspended',
}

@Entity('user_sys')
export class UserSys {
  @PrimaryGeneratedColumn('increment')
  user_sys_id!: number;

  @Column({ name: 'email', unique: true })
  email?: string;

  @Column({ name: 'password' })
  password?: string;

  @Column({ name: 'first_name' })
  first_name?: string;

  @Column({ name: 'middle_name', type: 'varchar', nullable: true })
  middle_name?: string | null;

  @Column({ name: 'last_name' })
  last_name?: string;

  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone?: string | null;

  @Column({ name: 'role_id' })
  role_id?: number;

  @Column({ name: 'code', type: 'varchar', nullable: true })
  code?: string | null;

  @Column({ name: 'edu_lev_id', type: 'int', nullable: true })
  edu_lev_id?: number | null;

  @Column({ name: 'inst_id', type: 'int', nullable: true })
  inst_id!: number | null;

  @Column({ name: 'user_status', type: 'varchar', nullable: true })
  user_status?: UserStatus | null;

  @Column({ name: 'profile_pic', type: 'varchar', nullable: true })
  profile_pic?: string | null;

  @Column({ name: 'flag_valid', default: true })
  flag_valid?: boolean;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at?: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updated_at?: Date;
}
