import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ai_chat')
export class AiChat {
  @PrimaryGeneratedColumn('increment')
  ai_chat_id!: number;

  @Column({ name: 'post_content_id', type: 'int' })
  post_content_id!: number;

  @Column({ name: 'chat_title', type: 'varchar', nullable: true })
  chat_title?: string;

  @Column({ name: 'summary_text', type: 'text', nullable: true })
  summary_text?: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @Column({ name: 'flag_valid', type: 'boolean', default: true })
  flag_valid!: boolean;
  
}
