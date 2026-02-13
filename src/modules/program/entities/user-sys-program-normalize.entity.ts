// user-sys-program-normalize.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, PrimaryColumn } from 'typeorm';

@Entity('user_sys_program_normalize')
export class UserSysProgramNormalize {

  @PrimaryColumn({ name: 'program_id' })
  program_id!: number;

  @PrimaryColumn({ name: 'user_sys_id' })
  user_sys_id!: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;
}
