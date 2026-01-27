// edu-level-program-normalize.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('edu_level_program_normalize')
export class EduLevelProgramNormalize {
  @PrimaryGeneratedColumn('increment')
  edu_level_program_normalize_id: number;

  @Column({ name: 'edu_lev_id' })
  edu_lev_id: number;

  @Column({ name: 'program_id' })
  program_id: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;
}
