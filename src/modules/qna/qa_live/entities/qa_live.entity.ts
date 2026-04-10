import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('qa_live')
export class QALive {
  @PrimaryGeneratedColumn('increment')
  qa_live_id!: number;

  @Column({ name: 'section_id' })
  section_id!: number;

  @Column({ name: 'live_title' })
  live_title!: string;

  @Column({ name: 'live_by' })
  live_by?: number;

  @Column({ name: 'status', type: 'text' })
  status!: string;

  @Column({ name: 'started_at', type: 'timestamp' })
  started_at!: Date;

  @Column({ name: 'ended_at', type: 'timestamp' })
  ended_at?: Date;

  @Column({ name: 'flag_valid', type: 'boolean', default: true })
  flag_valid!: boolean;
}
