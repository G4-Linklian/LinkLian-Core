// semester-subject-normalize.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('semester_subject_normalize')
export class SemesterSubjectNormalize {
  @PrimaryGeneratedColumn('increment')
  semester_subject_normalize_id: number;

  @Column({ name: 'subject_id' })
  subject_id: number;

  @Column({ name: 'semester_id' })
  semester_id: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;
}
