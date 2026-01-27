import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_sys_chat_normalize')
export class UserSysChatNormalize {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'user_sys_id' })
  user_sys_id: number;

  @Column({ name: 'chat_id' })
  chat_id: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;
}
