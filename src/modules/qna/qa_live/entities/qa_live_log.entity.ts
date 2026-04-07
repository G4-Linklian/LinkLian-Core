import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('qa_live_log')
export class QALiveLog {
    @PrimaryGeneratedColumn('increment')
    log_id!: number;

    @Column({ name: 'qa_live_id' })
    qa_live_id!: number;

    @Column({ name: 'post_id', type: 'integer' })
    post_id!: number;

    @Column({ name: 'attachment_id', type: 'integer' })
    attachment_id!: number;

    @Column({ name: 'opened_at', type: 'timestamp' })
    opened_at!: Date;

    @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
    closed_at?: Date;

    @Column({ name: 'flag_valid', type: 'boolean', default: true })
    flag_valid!: boolean;
}