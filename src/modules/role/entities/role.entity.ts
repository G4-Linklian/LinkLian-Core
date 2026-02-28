import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('role') // ชื่อ Table ใน Database
export class Role {
  @PrimaryGeneratedColumn('increment')
  role_id!: number;

  @Column({ name: 'role_name' })
  role_name!: string;

  @Column({ name: 'role_type' })
  role_type!: string;

  @Column({ name: 'access', type: 'jsonb', nullable: true })
  access!: object;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
