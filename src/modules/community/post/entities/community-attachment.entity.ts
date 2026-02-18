import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('community_attachment')
export class CommunityAttachmentEntity {

  @PrimaryGeneratedColumn()
  attachment_id: number;

  @Column()
  post_commu_id: number;

  @Column()
  file_url: string;

  @Column()
  file_type: string; // image | video | pdf

  @Column({ default: true })
  flag_valid: boolean;
}
