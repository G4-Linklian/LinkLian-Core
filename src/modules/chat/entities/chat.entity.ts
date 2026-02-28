import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('chat')
export class Chat {
  @PrimaryGeneratedColumn('increment')
  chat_id!: number;

  @Column({ name: 'is_ai_chat', default: false })
  is_ai_chat!: boolean;

  @Column({ name: 'last_sent', type: 'timestamp', nullable: true })
  last_sent!: Date;

  @Column({ name: 'last_messages', type: 'text', nullable: true })
  last_messages!: string;

  @Column({ name: 'flag_valid', default: true })
  flag_valid!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
