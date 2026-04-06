import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QAQuestion } from './entities/qa_question.entity';
import {
    SearchQuestionDto,
    CreateQuestionDto,
    UpdateQuestionDto,
    QANewQuestionEvent,
    QAQuestionUpdatedEvent,
    MaskedAsker,
} from './dto/qa_question.dto';
import { UserSys } from 'src/modules/users/entities/user-sys.entity';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { QnaRedisService } from '../redis/qna-redis.service';

@Injectable()
export class QALiveService {
    constructor(
        @InjectRepository(QAQuestion)
        private readonly qaQuestionRepo: Repository<QAQuestion>,
        private readonly dataSource: DataSource,
        private readonly logger: AppLogger,
        private readonly rabbitMQService: RabbitMQService,
        private readonly qnaRedisService: QnaRedisService,
    ) { }

    async findQuestionById(qa_question_id: number) {
        const cachedQuestion = await this.qnaRedisService.getQuestion(qa_question_id);
        this.logger.debug('Fetched question from Redis', 'Find Question By ID', { qa_question_id, cachedQuestion });

        if (cachedQuestion && cachedQuestion.flag_valid) {
            return { success: true, data: cachedQuestion };
        }

        const qaQuestion = await this.qaQuestionRepo.findOne({
            where: { qa_question_id, flag_valid: true },
        });

        if (!qaQuestion) {
            throw new NotFoundException(`QA Question with ID ${qa_question_id} not found`);
        }

        await this.qnaRedisService.cacheQuestion(qaQuestion);
        this.logger.debug('Question cached in Redis', 'Find Question By ID', { qa_question_id });

        return { success: true, data: qaQuestion };
    }

    async searchQuestion(dto: SearchQuestionDto) {
        const hasInput =
            dto.qa_question_id ||
            dto.qa_live_id ||
            dto.asker_id ||
            dto.post_id ||
            dto.attachment_id ||
            dto.slide_number ||
            dto.status ||
            dto.upvote_count ||
            typeof dto.is_anonymous === 'boolean' ||
            typeof dto.flag_valid === 'boolean';

        if (!hasInput) {
            throw new BadRequestException('No value input!');
        }

        try {
            if (this.canUseQuestionListCache(dto)) {
                const cachedQuestions = await this.qnaRedisService.getQuestionList(dto.qa_live_id!);
                this.logger.debug('Fetched question list from Redis', 'Search Question', { qa_live_id: dto.qa_live_id, cachedQuestions });

                if (cachedQuestions) {
                    return { success: true, data: this.maskQuestions(cachedQuestions) };
                }
            }

            const query = this.qaQuestionRepo.createQueryBuilder('qa_question');

            if (dto.qa_question_id) {
                query.andWhere('qa_question.qa_question_id = :qa_question_id', { qa_question_id: dto.qa_question_id });
            }
            if (dto.qa_live_id) {
                query.andWhere('qa_question.qa_live_id = :qa_live_id', { qa_live_id: dto.qa_live_id });
            }
            if (dto.asker_id) {
                query.andWhere('qa_question.asker_id = :asker_id', { asker_id: dto.asker_id });
                query.leftJoinAndMapOne(
                    'qa_question.asker',
                    UserSys,
                    'u',
                    'qa_question.asker_id = u.user_sys_id'
                );
            }
            if (typeof dto.is_anonymous === 'boolean') {
                query.andWhere('qa_question.is_anonymous = :is_anonymous', { is_anonymous: dto.is_anonymous });
            }
            if (dto.question) {
                query.andWhere('qa_question.question LIKE :question', { question: `%${dto.question}%` });
            }
            if (dto.post_id) {
                query.andWhere('qa_question.post_id = :post_id', { post_id: dto.post_id });
            }
            if (dto.attachment_id) {
                query.andWhere('qa_question.attachment_id = :attachment_id', { attachment_id: dto.attachment_id });
            }
            if (dto.slide_number) {
                query.andWhere('qa_question.slide_number = :slide_number', { slide_number: dto.slide_number });
            }
            if (dto.status) {
                query.andWhere('qa_question.status = :status', { status: dto.status });
            }
            if (dto.upvote_count) {
                query.andWhere('qa_question.upvote_count = :upvote_count', { upvote_count: dto.upvote_count });
            }
            if (typeof dto.flag_valid === 'boolean') {
                query.andWhere('qa_question.flag_valid = :flag_valid', { flag_valid: dto.flag_valid });
            }
            if (dto.sort_by) {
                const order = dto.sort_order || 'ASC';
                query.orderBy(`qa_question.${dto.sort_by}`, order);
            } else {
                query.orderBy('qa_question.created_at', 'ASC');
                query.addOrderBy('qa_question.upvote_count', 'DESC');
            }

            const qaQuestion = await query.getMany();

            if (dto.qa_live_id) {
                await this.qnaRedisService.cacheQuestionList(dto.qa_live_id, qaQuestion);
                this.logger.debug('Cached question list in Redis', 'Search Question', { qa_live_id: dto.qa_live_id });
            }

            const maskedQuestions = this.maskQuestions(qaQuestion);

            return { success: true, data: maskedQuestions };
        } catch (error) {
            this.logger.error('Error searching QA Question', 'Search QA Question', error);
            throw new InternalServerErrorException('Failed to search QA Question');
        }
    }

    async createQuestion(dto: CreateQuestionDto) {
        if (
            !dto.qa_live_id ||
            !dto.question ||
            !dto.post_id ||
            !dto.attachment_id ||
            !dto.asker_id ||
            !dto.slide_number ||
            typeof dto.is_anonymous === 'undefined'
        ) {
            throw new BadRequestException('QA Live ID, Question, Post ID, Attachment ID, Slide Number, and Is Anonymous are required.');
        }

        try {
            const newQuestion = this.qaQuestionRepo.create({
                qa_live_id: dto.qa_live_id,
                asker_id: dto.asker_id,
                question: dto.question,
                post_id: dto.post_id,
                attachment_id: dto.attachment_id,                
                slide_number: dto.slide_number,
                is_anonymous: dto.is_anonymous,
                status: 'PENDING',
                upvote_count: 0,
                created_at: new Date(),
                flag_valid: true,
            });

            const savedQuestion = await this.qaQuestionRepo.save(newQuestion);

            await this.qnaRedisService.cacheQuestion(savedQuestion);
            this.logger.debug('Question cached in Redis', 'Create QA Question', { qa_question_id: savedQuestion.qa_question_id });

            const askerInfo = await this.dataSource.getRepository(UserSys).findOne({
                where: { user_sys_id: dto.asker_id },
            });

            const eventAsker = this.maskedAskerEvent(dto.qa_live_id, dto.is_anonymous, askerInfo);
            await this.newQuestion(dto.qa_live_id, savedQuestion, eventAsker);

            return { success: true, data: newQuestion };
        } catch (error) {
            this.logger.error('Error creating QA Question', 'Create QA Question', error);
            throw new InternalServerErrorException('Failed to create QA Question');
        }
    }

    async updateQuestion(qa_question_id: number, dto: UpdateQuestionDto) {
        const question = await this.qaQuestionRepo.findOne({
            where: { qa_question_id, flag_valid: true },
        });

        if (!question) {
            throw new NotFoundException('QA Question not found');
        }

        try {
            const updateData: any = {};

            if (dto.status && question.status !== dto.status) {
                updateData.status = dto.status;
            }
            if (dto.question && question.question !== dto.question) {
                updateData.question = dto.question;
            }
            if (dto.flag_valid !== undefined && question.flag_valid !== dto.flag_valid) {
                updateData.flag_valid = dto.flag_valid;
            }
            if (dto.upvote_count !== undefined && question.upvote_count !== dto.upvote_count) {
                updateData.upvote_count = dto.upvote_count;
            }

            if (Object.keys(updateData).length > 0) {
                await this.qaQuestionRepo.update(qa_question_id, updateData);

                const updatedQuestion: QAQuestion = {
                    ...question,
                    ...updateData,
                };

                await this.qnaRedisService.cacheQuestion(updatedQuestion);
                this.logger.debug('Updated question cached in Redis', 'Update QA Question', { qa_question_id });

                if (updateData.status) {
                    await this.qnaRedisService.updateQuestionStatus(qa_question_id, updateData.status);
                }

                await this.questionUpdated(updatedQuestion.qa_live_id, updatedQuestion);
            }

            return { success: true, message: `QA Question with ID ${qa_question_id} updated successfully` };
        } catch (error) {
            this.logger.error('Error updating QA Question', 'Update QA Question', error);
            throw new InternalServerErrorException('Failed to update QA Question');
        }
    }

    private maskedAskerEvent(qaLiveId: number, isAnonymous: boolean, askerInfo: UserSys | null): MaskedAsker {
        if (isAnonymous || !askerInfo) {
            const hashValue = Math.abs((qaLiveId * 73856) ^ qaLiveId);
            const random4Digits = String(hashValue % 10000).padStart(4, '0');

            return {
                user_id: 0,
                first_name: 'ผู้ใช้ไม่ระบุตัวตน',
                last_name: random4Digits,
                profile_pic: null,
            };
        }

        return {
            user_id: askerInfo.user_sys_id,
            first_name: askerInfo.first_name ?? '',
            last_name: askerInfo.last_name ?? '',
            profile_pic: askerInfo.profile_pic ?? null,
        };
    }

    private async newQuestion(qaLiveId: number, question: QAQuestion, asker: MaskedAsker): Promise<void> {
        const eventMessage: QANewQuestionEvent = {
            type: 'QA_NEW_QUESTION',
            payload: {
                qa_question_id: question.qa_question_id,
                qa_live_id: qaLiveId,
                question: question.question,
                asker,
                post_id: question.post_id,
                attachment_id: question.attachment_id!,
                slide_number: question.slide_number,
                status: question.status,
                upvote_count: question.upvote_count,
                created_at: question.created_at,
            }
        };

        this.logger.debug(
            'Publishing message to RabbitMQ:',
            'QALiveService',
            eventMessage,
        );

        await this.rabbitMQService.publish(
            'linklian_events',
            `qa_live.${qaLiveId}.question.new`,
            eventMessage
        );

        this.logger.debug('Message published to RabbitMQ successfully', 'QALiveService');
    }

    private async questionUpdated(qaLiveId: number, question: QAQuestion): Promise<void> {
        const eventMessage: QAQuestionUpdatedEvent = {
            type: 'QA_QUESTION_UPDATED',
            payload: {
                qa_question_id: question.qa_question_id,
                qa_live_id: qaLiveId,
                question: question.question,
                status: question.status,
            }
        };

        this.logger.debug(
            'Publishing message to RabbitMQ:',
            'QALiveService',
            eventMessage,
        );

        await this.rabbitMQService.publish(
            'linklian_events',
            `qa_live.${qaLiveId}.question.updated`,
            eventMessage
        );

        this.logger.debug('Message published to RabbitMQ successfully', 'QALiveService');
    }

    private canUseQuestionListCache(dto: SearchQuestionDto): boolean {
        return Boolean(
            dto.qa_live_id &&
            !dto.qa_question_id &&
            !dto.asker_id &&
            typeof dto.is_anonymous === 'undefined' &&
            !dto.question &&
            !dto.post_id &&
            !dto.attachment_id &&
            !dto.slide_number &&
            !dto.status &&
            !dto.upvote_count &&
            typeof dto.flag_valid === 'undefined' &&
            !dto.sort_by &&
            !dto.sort_order,
        );
    }

    private maskQuestions(questions: QAQuestion[]): QAQuestion[] {
        return questions.map((question: any) => {
            if (question.is_anonymous) {
                const hashValue = Math.abs((question.asker_id * 73856) ^ question.qa_live_id);
                const random4Digits = String(hashValue % 10000).padStart(4, '0');

                question.asker_id = null;

                if (question.asker) {
                    question.asker = {
                        user_sys_id: null,
                        first_name: 'ผู้ใช้ไม่ระบุตัวตน',
                        last_name: random4Digits,
                        profile_pic: null,
                    };
                }

                return question;
            }

            if (question.asker) {
                question.asker = {
                    user_sys_id: question.asker.user_sys_id,
                    first_name: question.asker.first_name,
                    last_name: question.asker.last_name,
                    profile_pic: question.asker.profile_pic,
                };
            }

            return question;
        });
    }
}