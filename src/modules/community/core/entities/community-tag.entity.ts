import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('community_tag')
export class CommunityTagEntity {

  @PrimaryGeneratedColumn()
  community_tag_id: number;

  @Column({ unique: true })
  tag_name: string;

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'now()',
  })
  created_at: Date;

  @Column({ default: true })
  flag_valid: boolean;
}
