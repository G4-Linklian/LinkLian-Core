import {
  Entity,
  Column,
  PrimaryColumn,
} from 'typeorm';

@Entity('admin_user') // ชื่อ Table ใน Database
export class Admin {
  @PrimaryColumn({ type: 'varchar', name: 'username' })
  username!: string;

  @Column({ name: 'password' })
  password!: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;
}
