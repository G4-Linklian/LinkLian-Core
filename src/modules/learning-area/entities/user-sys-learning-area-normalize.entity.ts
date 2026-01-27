// user-sys-learning-area-normalize.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_sys_learning_area_normalize')
export class UserSysLearningAreaNormalize {
  @PrimaryGeneratedColumn('increment')
  user_sys_learning_area_normalize_id: number;

  @Column({ name: 'learning_area_id' })
  learning_area_id: number;

  @Column({ name: 'user_sys_id' })
  user_sys_id: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;
}
