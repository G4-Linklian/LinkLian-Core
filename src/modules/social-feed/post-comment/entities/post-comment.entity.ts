// post-comment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('post_comment')
export class PostComment {
  @PrimaryGeneratedColumn()
  comment_id: number;

  @Column()
  post_id: number;

  @Column()
  user_sys_id: number;

  @Column({ default: false })
  is_anonymous: boolean;

  @Column('text')
  comment_text: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ default: true })
  flag_valid: boolean;
}
