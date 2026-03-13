import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('ai_chat')
export class AiChat {
  @PrimaryGeneratedColumn('increment')
  ai_chat_id: number;

  @Column()
  post_content_id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  chat_title: string;

  @Column({ type: 'text', nullable: true })
  summary_text: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: true })
  flag_valid: boolean;
}