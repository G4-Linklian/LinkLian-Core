// semester-subject-normalize.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, PrimaryColumn } from 'typeorm';

@Entity('semester_subject_normalize')
export class SemesterSubjectNormalize {
  @PrimaryColumn({ name: 'subject_id' })
  subject_id!: number;

  @PrimaryColumn({ name: 'semester_id' })
  semester_id!: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid?: boolean;
}
