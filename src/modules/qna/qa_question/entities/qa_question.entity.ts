import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('qa_question')
export class QAQuestion {
    @PrimaryGeneratedColumn('increment')
    qa_question_id!: number;

    @Column({ name: 'qa_live_id' })
    qa_live_id!: number;

    @Column({ name: 'asker_id' })
    asker_id?: number;

    @Column({ name: 'is_anonymous', type: 'boolean', default: false })
    is_anonymous?: boolean;

    @Column({ name: 'question', type: 'text' })
    question!: string;

    @Column({ name: 'post_id', type: 'integer' })
    post_id!: number;

    @Column({ name: 'attachment_id', type: 'integer' })
    attachment_id?: number;

    @Column({ name: 'slide_number', type: 'numeric' })
    slide_number!: number;

    @Column({ name: 'status', type: 'text' })
    status!: string;

    @Column({ name: 'upvote_count' })
    upvote_count!: number;

    @CreateDateColumn({ name: 'created_at' })
    created_at!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updated_at?: Date;

    @Column({ name: 'flag_valid', default: true })
    flag_valid!: boolean;
}
