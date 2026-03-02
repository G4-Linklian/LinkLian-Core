import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('message')
export class Message {
  @PrimaryGeneratedColumn('increment')
  message_id!: number;

  @Column({ name: 'chat_id' })
  chat_id!: number;

  @Column({ name: 'sender_id' })
  sender_id!: number;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @Column({ name: 'reply_id', type: 'int', nullable: true })
  reply_id?: number | null;

  @Column({ name: 'file', type: 'jsonb', nullable: true })
  file?: object[] | null;

  @Column({ name: 'status', default: 'SENDED' })
  status!: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}
