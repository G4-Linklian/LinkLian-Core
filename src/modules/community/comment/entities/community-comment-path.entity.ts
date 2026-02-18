import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('community_comment_path')
export class CommunityCommentPath {
  @PrimaryColumn()
  ancestor_id: number;

  @PrimaryColumn()
  descendant_id: number;

  @Column()
  path_length: number;

  @Column({ default: true })
  flag_valid: boolean;
}
