import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('quiz_attempt')
export class QuizAttempt {

  @PrimaryGeneratedColumn('increment')
  attempt_id: number;

  @Column()
  quiz_id: number;

  @Column()
  user_sys_id: number;

  @Column()
  score: number;

  @Column()
  total: number;

  @Column({ type: 'jsonb', nullable: true })
  answers: any;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: true })
  flag_valid: boolean;
}