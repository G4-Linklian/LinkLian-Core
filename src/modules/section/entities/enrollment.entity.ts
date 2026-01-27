// enrollment.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('enrollment')
export class Enrollment {
  @PrimaryGeneratedColumn('increment')
  enrollment_id: number;

  @Column({ name: 'section_id' })
  section_id: number;

  @Column({ name: 'student_id' })
  student_id: number;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @CreateDateColumn({ name: 'enrolled_at' })
  enrolled_at: Date;
}
