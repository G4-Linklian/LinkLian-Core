import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('community')
export class CommunityEntity {
  @PrimaryGeneratedColumn()
  community_id: number;

  @Column()
  is_private: boolean;

  @Column({ name: 'community_name' })
  community_name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  rule: any;

  @Column()
  image_banner: string;

  @Column()
  status: string; // active / inactive

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updated_at: Date;

  @Column({ default: true })
  flag_valid: boolean;
}
