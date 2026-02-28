// post-content.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Enum for post type
 */
export enum PostType {
  ANNOUNCEMENT = 'announcement',
  MATERIAL = 'material',
  ASSIGNMENT = 'assignment',
  QUESTION = 'question',
  DISCUSSION = 'discussion',
}

@Entity('post_content')
export class PostContent {
  @PrimaryGeneratedColumn('increment')
  post_content_id: number;

  @Column({ name: 'user_sys_id' })
  user_sys_id: number;

  @Column({ name: 'title', type: 'varchar', nullable: true })
  title: string | null;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'post_type', type: 'varchar', nullable: true })
  post_type: string | null;

  @Column({ name: 'is_anonymous', default: false })
  is_anonymous: boolean;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
