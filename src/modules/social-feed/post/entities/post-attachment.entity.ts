// post-attachment.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('post_attachment')
export class PostAttachment {
  @PrimaryGeneratedColumn('increment')
  attachment_id: number;

  @Column({ name: 'post_content_id' })
  post_content_id: number;

  @Column({ name: 'file_url' })
  file_url: string;

  @Column({ name: 'file_type' })
  file_type: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
