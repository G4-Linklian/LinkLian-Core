import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('quiz')
export class Quiz {
  @PrimaryGeneratedColumn('increment')
  quiz_id: number;

  @Column()
  ai_chat_id: number;

  @Column({ type: 'jsonb' })
  quiz_detail: any;

  @Column({ type: 'varchar', length: 10 })
  difficulty: string;

  @Column({
    type: 'varchar',
    default: 'exam',
  })
  mode: 'exam' | 'learning';

  @Column()
  question_count: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: true })
  flag_valid: boolean;
}