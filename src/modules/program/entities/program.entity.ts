// program.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Enum for program tree type
 */
export enum TreeType {
  ROOT = 'root',
  TWIG = 'twig',
  LEAF = 'leaf',
}

/**
 * Enum for program type
 */
export enum ProgramType {
  DEPARTMENT = 'department',
  FACULTY = 'faculty',
  MAJOR = 'major',
  STUDY_PLAN = 'study_plan',
  CLASS = 'class',
}

@Entity('program')
export class Program {
  @PrimaryGeneratedColumn('increment')
  program_id!: number;

  @Column({ name: 'inst_id' })
  inst_id!: number;

  @Column({ name: 'program_name' })
  program_name!: string;

  @Column({ name: 'program_type' })
  program_type!: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parent_id?: number | null;

  @Column({ name: 'remark', type: 'text', nullable: true })
  remark?: string | null;

  @Column({ name: 'tree_type' })
  tree_type!: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP'
  })
  created_at?: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP'
  })
  updated_at?: Date;
}
