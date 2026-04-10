import {
    Entity,
    Column,
    PrimaryColumn,
} from 'typeorm';

@Entity('qa_question_upvote')
export class QaQuestionUpvote {
    @PrimaryColumn({ name: 'qa_question_id' })
    qa_question_id!: number;

    @PrimaryColumn({ name: 'voter_id' })
    voter_id!: number;

    @Column({ name: 'flag_valid', type: 'boolean', default: true })
    flag_valid!: boolean;
}
