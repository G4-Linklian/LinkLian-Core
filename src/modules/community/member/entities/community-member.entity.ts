import {
  Entity,
  Column,
  PrimaryColumn,
} from 'typeorm';

@Entity('community_member')
export class CommunityMemberEntity {

  @PrimaryColumn()
  community_id: number;

  @PrimaryColumn()
  user_sys_id: number;

  @Column()
  role: string; // owner / member

  @Column()
  status: string; // active / pending

  @Column({ type: 'timestamptz', nullable: true })
  request_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approve_at: Date;

  @Column({ default: true })
  flag_valid: boolean;
}

