// subject.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('subject')
export class Subject {
  @PrimaryGeneratedColumn('increment')
  subject_id: number;

  @Column({ name: 'learning_area_id' })
  learning_area_id: number;

  @Column({ name: 'subject_code' })
  subject_code: string;

  @Column({ name: 'name_th' })
  name_th: string;

  @Column({ name: 'name_en', type: 'varchar', nullable: true })
  name_en: string | null;

  @Column({ name: 'credit', type: 'decimal', precision: 3, scale: 1 })
  credit: number;

  @Column({ name: 'hour_per_week', type: 'decimal', precision: 3, scale: 1 })
  hour_per_week: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
