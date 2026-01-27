// semester.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Enum for semester status
 */
export enum SemesterStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('semester')
export class Semester {
  @PrimaryGeneratedColumn('increment')
  semester_id: number;

  @Column({ name: 'inst_id' })
  inst_id: number;

  @Column({ name: 'semester' })
  semester: string;

  @Column({ name: 'start_date', type: 'date' })
  start_date: Date;

  @Column({ name: 'end_date', type: 'date' })
  end_date: Date;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @Column({ name: 'status', default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
