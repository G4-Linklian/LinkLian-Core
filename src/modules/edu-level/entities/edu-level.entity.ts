// edu-level.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Enum for education type
 */
export enum EduType {
  HIGH = 'high school',
  UNI = 'bachelor',
}

@Entity('edu_level')
export class EduLevel {
  @PrimaryGeneratedColumn('increment')
  edu_lev_id!: number;

  @Column({ name: 'level_name' })
  level_name!: string;

  @Column({ name: 'edu_type' })
  edu_type!: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;
}
