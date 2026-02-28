// enrollment.entity.ts
import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('enrollment')
export class Enrollment {
  @PrimaryColumn({ name: 'section_id' })
  section_id!: number;

  @PrimaryColumn({ name: 'student_id' })
  student_id!: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;

  @CreateDateColumn({ name: 'enrolled_at' })
  enrolled_at!: Date;
}
