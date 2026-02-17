import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('community_tag_normalize')
export class CommunityTagNormalizeEntity {

  @PrimaryColumn()
  community_tag_id: number;

  @PrimaryColumn()
  community_id: number;

  @Column({ default: true })
  flag_valid: boolean;
}
