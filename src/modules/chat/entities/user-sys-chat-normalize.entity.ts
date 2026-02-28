import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('user_sys_chat_normalize')
export class UserSysChatNormalize {
  @PrimaryColumn({ name: 'user_sys_id' })
  user_sys_id!: number;

  @PrimaryColumn({ name: 'chat_id' })
  chat_id!: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;
}
