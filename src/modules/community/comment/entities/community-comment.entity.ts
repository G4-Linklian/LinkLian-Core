import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('community_comment')
export class CommunityComment {
  @PrimaryGeneratedColumn()
  commu_comment_id: number;

  @Column()
  post_commu_id: number;

  @Column()
  user_sys_id: number;

  @Column({ type: 'text' })
  comment_text: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ default: true })
  flag_valid: boolean;
}
