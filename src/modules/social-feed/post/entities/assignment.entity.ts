// assignment.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('assignment')
export class Assignment {
  @PrimaryGeneratedColumn('increment')
  assignment_id: number;

  @Column({ name: 'post_id' })
  post_id: number;

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  due_date: Date | null;

  @Column({ name: 'max_score', type: 'numeric', nullable: true })
  max_score: number | null;

  @Column({ name: 'is_group', default: false })
  is_group: boolean;

  @Column({ name: 'flag_valid', default: true })
  flag_valid: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
