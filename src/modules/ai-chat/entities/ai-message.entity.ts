import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ai_message')
export class AiMessage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  ai_message_id!: string;

  @Column({ name: 'ai_chat_id', type: 'bigint' })
  ai_chat_id!: string;

  @Column({ name: 'role', type: 'varchar' })
  role!: string;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @Column({ name: 'flag_valid', type: 'boolean', default: true })
  flag_valid!: boolean;
}
