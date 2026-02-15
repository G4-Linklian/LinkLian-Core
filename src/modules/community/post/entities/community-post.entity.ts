import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('post_in_community')
export class CommunityPostEntity {
  @PrimaryGeneratedColumn()
  post_commu_id: number;

  @Column()
  community_id: number;

  @Column()
  user_sys_id: number;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'now()',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'now()',
  })
  updated_at: Date;

  @Column({
    type: 'boolean',
    default: true,
  })
  flag_valid: boolean;
}
