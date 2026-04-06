import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { QaQuestionUpvote } from './entities/qa_question_upvote.entity';
import { QAQuestion } from '../qa_question/entities/qa_question.entity';
import {
    CreateUpvoteDto,
    DeleteUpvoteDto,
    SearchUpvoteDto,
    QAUpvotedEvent,
} from './dto/qa_upvote.dto';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { QnaRedisService } from '../redis/qna-redis.service';

@Injectable()
export class QALiveService {
    constructor(
        @InjectRepository(QaQuestionUpvote)
        private readonly qaQuestionUpvoteRepo: Repository<QaQuestionUpvote>,
        @InjectRepository(QAQuestion)
        private readonly qaQuestionRepo: Repository<QAQuestion>,
        private readonly dataSource: DataSource,
        private readonly logger: AppLogger,
        private readonly rabbitMQService: RabbitMQService,
        private readonly qnaRedisService: QnaRedisService,
    ) { }

    async searchUpvote(dto: SearchUpvoteDto) {
        const hasInput =
            dto.qa_question_id ||
            dto.voter_id;

        if (!hasInput) {
            throw new BadRequestException('No value input!');
        }

        try {
            const query = this.qaQuestionUpvoteRepo.createQueryBuilder('qa_question_upvote');

            if (dto.qa_question_id) {
                query.andWhere('qa_question_upvote.qa_question_id = :qa_question_id', { qa_question_id: dto.qa_question_id });
            }
            if (dto.voter_id) {
                query.andWhere('qa_question_upvote.voter_id = :voter_id', { voter_id: dto.voter_id });
            }
            if (typeof dto.flag_valid === 'boolean') {
                query.andWhere('qa_question.flag_valid = :flag_valid', { flag_valid: dto.flag_valid });
            }

            const upvotes = await query.getMany();

            return { success: true, data: upvotes };
        } catch (error) {
            this.logger.error('Error searching QA Upvote', 'Search QA Upvote', error);
            throw new InternalServerErrorException('Failed to search QA Upvote');
        }
    }

    async createUpvote(dto: CreateUpvoteDto) {
        if (!dto.voter_id || !dto.qa_question_id) {
            throw new BadRequestException('Voter ID and QA Question ID are required.');
        }

        const existingUpvote = await this.qaQuestionUpvoteRepo.findOne({
            where: {
                voter_id: dto.voter_id,
                qa_question_id: dto.qa_question_id,
            },
        });

        if (existingUpvote) {
            throw new BadRequestException('Upvote already exists for this question and voter.');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        let newUpvote: QaQuestionUpvote;

        try {
            newUpvote = queryRunner.manager.create(QaQuestionUpvote, {
                voter_id: dto.voter_id,
                qa_question_id: dto.qa_question_id,
                flag_valid: true,
            });

            await queryRunner.manager.save(newUpvote);

            await queryRunner.manager.increment(QAQuestion,
                { qa_question_id: dto.qa_question_id },
                'upvote_count',
                1,
            );

            try {
                const updatedQuestion = await this.qaQuestionRepo.findOne({
                    where: { qa_question_id: dto.qa_question_id },
                });

                if (updatedQuestion) {
                    await this.qnaRedisService.cacheQuestion(updatedQuestion);
                    await this.qnaRedisService.updateQuestionUpvote(
                        updatedQuestion.qa_question_id,
                        updatedQuestion.upvote_count,
                    );
                    this.logger.debug(
                        'Updated question upvote count in Redis', 
                        'Create QA Upvote', 
                        { qa_question_id: updatedQuestion.qa_question_id, upvote_count: updatedQuestion.upvote_count }
                    );

                    await this.questionUpvoted(
                        updatedQuestion.qa_live_id,
                        updatedQuestion.qa_question_id,
                        updatedQuestion.upvote_count,
                    );
                }
            } catch (error) {
                this.logger.error('Error publishing QA question upvoted event', 'Create QA Upvote', error);
            }

            await queryRunner.commitTransaction();

            return { success: true, data: newUpvote };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Error creating QA Upvote', 'Create QA Upvote', error);
            throw new InternalServerErrorException('Failed to create QA Upvote');
        } finally {
            await queryRunner.release();

        }
    }

    async deleteUpvote(dto: DeleteUpvoteDto) {
        if (!dto.voter_id || !dto.qa_question_id) {
            throw new BadRequestException('Voter ID and QA Question ID are required.');
        }

        const existingUpvote = await this.qaQuestionUpvoteRepo.findOne({
            where: {
                voter_id: dto.voter_id,
                qa_question_id: dto.qa_question_id,
            },
        });

        if (!existingUpvote) {
            throw new BadRequestException('Upvote not found for this question and voter.');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            await queryRunner.manager.remove(existingUpvote);

            await queryRunner.manager.decrement(QAQuestion,
                { qa_question_id: dto.qa_question_id },
                'upvote_count',
                1,
            );

            try {
                const updatedQuestion = await this.qaQuestionRepo.findOne({
                    where: { qa_question_id: dto.qa_question_id },
                });

                if (updatedQuestion) {
                    await this.qnaRedisService.cacheQuestion(updatedQuestion);
                    await this.qnaRedisService.updateQuestionUpvote(
                        updatedQuestion.qa_question_id,
                        updatedQuestion.upvote_count,
                    );
                    this.logger.debug(
                        'Updated question upvote count in Redis', 
                        'Delete QA Upvote', 
                        { qa_question_id: updatedQuestion.qa_question_id, upvote_count: updatedQuestion.upvote_count }
                    );

                    await this.questionUpvoted(
                        updatedQuestion.qa_live_id,
                        updatedQuestion.qa_question_id,
                        updatedQuestion.upvote_count,
                    );
                }
            } catch (error) {
                this.logger.error('Error publishing QA question upvoted event', 'Delete QA Upvote', error);
            }

            await queryRunner.commitTransaction();

            return { success: true, message: 'Upvote deleted successfully' };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Error deleting QA Upvote', 'Delete QA Upvote', error);
            throw new InternalServerErrorException('Failed to delete QA Upvote');
        } finally {
            await queryRunner.release();
        } 
    }

    private async questionUpvoted(qaLiveId: number, questionId: number, CurrentUpvoteCount: number): Promise<void> {
        const eventMessage: QAUpvotedEvent = {
            type: 'QA_UPVOTED',
            payload: {
                qa_question_id: questionId,
                qa_live_id: qaLiveId,
                upvote_count: CurrentUpvoteCount,
            }
        };

        this.logger.debug(
            'Publishing message to RabbitMQ:',
            'QALiveService',
            eventMessage,
        );

        await this.rabbitMQService.publish(
            'linklian_events',
            `qa_live.${qaLiveId}.question.upvoted`,
            eventMessage
        );

        this.logger.debug('Message published to RabbitMQ successfully', 'QALiveService');
    }
}