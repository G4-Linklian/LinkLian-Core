// post-in-class.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('post_in_class')
export class PostInClass {
  @PrimaryGeneratedColumn('increment')
  post_id: number;

  @Column({ name: 'post_content_id' })
  post_content_id: number;

  @Column({ name: 'section_id' })
  section_id: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
