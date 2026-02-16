// edu-level-program-normalize.entity.ts
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('edu_level_program_normalize')
export class EduLevelProgramNormalize {
  @PrimaryColumn({ name: 'edu_lev_id' })
  edu_lev_id!: number;

  @PrimaryColumn({ name: 'program_id' })
  program_id!: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;
}
