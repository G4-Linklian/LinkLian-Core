// section.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('section')
export class Section {
  @PrimaryGeneratedColumn('increment')
  section_id!: number;

  @Column({ name: 'subject_id' })
  subject_id!: number;

  @Column({ name: 'semester_id' })
  semester_id!: number;

  @Column({ name: 'section_name', type: 'varchar', nullable: true })
  section_name!: string | null;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
