// post-comment-path.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Closure table for hierarchical comments (parent-child relationships)
 * Uses path_length to track depth in the tree
 */
@Entity('post_comment_path')
export class PostCommentPath {
  @PrimaryGeneratedColumn()
  path_id: number;

  @Column()
  ancestor_id: number;

  @Column()
  descendant_id: number;

  @Column({ default: 0 })
  path_length: number;

  @Column({ default: true })
  flag_valid: boolean;
}
