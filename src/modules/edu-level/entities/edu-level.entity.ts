// edu-level.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Enum for education type
 */
export enum EduType {
  KINDERGARTEN = 'อนุบาล',
  PRIMARY = 'ประถมศึกษา',
  SECONDARY = 'มัธยมศึกษา',
  VOCATIONAL = 'อาชีวศึกษา',
  HIGHER = 'อุดมศึกษา',
}

@Entity('edu_level')
export class EduLevel {
  @PrimaryGeneratedColumn('increment')
  edu_lev_id: number;

  @Column({ name: 'level_name' })
  level_name: string;

  @Column({ name: 'edu_type' })
  edu_type: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
