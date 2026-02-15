import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('community_bookmark')
export class CommunityBookmarkEntity {

  @PrimaryColumn()
  user_sys_id: number;

  @PrimaryColumn()
  post_commu_id: number;

  @CreateDateColumn()
  saved_at: Date;

}
