import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { QALive } from './entities/qa_live.entity';
import { QALiveLog } from './entities/qa_live_log.entity';
import {
    SearchQALiveDto,
    CreateQALiveDto,
    UpdateQALiveDto,
    SearchQALiveLogDto,
    CreateQALiveLogDto,
    QALiveStartEvent,
    QALiveEndEvent,
    FileChangeEvent,
    SearchSectionFilesDto,
} from './dto/qa_live.dto';
import { UserSys } from 'src/modules/users/entities/user-sys.entity';
import { PostInClass } from 'src/modules/social-feed/post/entities/post-in-class.entity';
import { PostAttachment } from 'src/modules/social-feed/post/entities/post-attachment.entity';
import { PostContent } from 'src/modules/social-feed/post/entities/post-content.entity';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { QnaRedisService } from '../redis/qna-redis.service';

@Injectable()
export class QALiveService {
    constructor(
        @InjectRepository(QALive)
        private readonly qaLiveRepo: Repository<QALive>,
        @InjectRepository(QALiveLog)
        private readonly qaLiveLogRepo: Repository<QALiveLog>,
        private readonly dataSource: DataSource,
        private readonly logger: AppLogger,
        private readonly rabbitMQService: RabbitMQService,
        private readonly qnaRedisService: QnaRedisService,
    ) { }

    async findQALiveById(qa_live_id: number) {
        const qaLive = await this.qaLiveRepo.findOne({
            where: { qa_live_id, flag_valid: true },
        });

        if (!qaLive) {
            throw new NotFoundException(`QA Live with ID ${qa_live_id} not found`);
        }

        return { success: true, data: qaLive };
    }

    async findActiveLive(section_id: number) {
        const qaLive = await this.qaLiveRepo.findOne({
            where: { section_id, status: 'ACTIVE', flag_valid: true },
        });

        if (!qaLive) {
            throw new NotFoundException(`No active QA Live found for Section ID ${section_id}`);
        }

        return { success: true, data: qaLive };
    }

    async searchQALive(dto: SearchQALiveDto) {
        const hasInput =
            dto.qa_live_id ||
            dto.section_id ||
            dto.live_by ||
            dto.status ||
            dto.live_title ||
            typeof dto.flag_valid === 'boolean';

        if (!hasInput) {
            throw new BadRequestException('No value input!');
        }

        try {
            const query = this.qaLiveRepo.createQueryBuilder('qa_live');

            if (dto.qa_live_id) {
                query.andWhere('qa_live.qa_live_id = :qa_live_id', { qa_live_id: dto.qa_live_id });
            }

            if (dto.section_id) {
                query.andWhere('qa_live.section_id = :section_id', { section_id: dto.section_id });
            }

            if (dto.live_by) {
                query.andWhere('qa_live.live_by = :live_by', { live_by: dto.live_by });
                query.leftJoinAndMapOne(
                    'qa_live.live_by',
                    UserSys,
                    'u',
                    'qa_live.live_by = u.user_sys_id'
                );
            }

            if (dto.live_title) {
                query.andWhere('qa_live.live_title ILIKE :live_title', { live_title: `%${dto.live_title}%` });
            }

            if (dto.status) {
                query.andWhere('qa_live.status = :status', { status: dto.status });
            }

            if (typeof dto.flag_valid === 'boolean') {
                query.andWhere('qa_live.flag_valid = :flag_valid', { flag_valid: dto.flag_valid });
            }

            if (dto.sort_by) {
                const order = dto.sort_order || 'ASC';
                query.orderBy(`qa_live.${dto.sort_by}`, order);
            }

            const qaLive = await query.getMany();

            return { success: true, data: qaLive };
        } catch (error) {
            this.logger.error('Error searching QA Live', 'Search QA Live', error);
            throw new InternalServerErrorException('Failed to search QA Live');
        }
    }

    async createQALive(dto: CreateQALiveDto) {
        if (
            !dto.section_id ||
            !dto.live_by ||
            !dto.post_id ||
            !dto.attachment_id ||
            !dto.live_title
        ) {
            throw new BadRequestException('Section ID, Live By, Post ID, Attachment ID, and Live Title are required.');
        }

        const existingLive = await this.qaLiveRepo.findOne({
            where: {
                section_id: dto.section_id,
                status: 'ACTIVE',
                flag_valid: true,
            },
        });

        if (existingLive) {
            throw new BadRequestException(`Section ID ${dto.section_id} already has an active QA Live.`);
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        let savedLive: QALive;

        try {
            const currentTime = new Date();

            const newLive = queryRunner.manager.create(QALive, {
                section_id: dto.section_id,
                live_by: dto.live_by,
                live_title: dto.live_title,
                status: 'ACTIVE',
                started_at: currentTime,
                flag_valid: true,
            });

            savedLive = await queryRunner.manager.save<QALive>(newLive);

            const newLog = queryRunner.manager.create(QALiveLog, {
                qa_live_id: savedLive.qa_live_id,
                post_id: dto.post_id,
                attachment_id: dto.attachment_id,
                opened_at: currentTime,
                flag_valid: true,
            });

            await queryRunner.manager.save(newLog);

            try {
                await this.liveRoomStarted(savedLive!);
            } catch (error) {
                this.logger.error('Error publishing QA Live started event', 'Create QA Live', error);
            }

            await queryRunner.commitTransaction();

            try {
                await this.qnaRedisService.setActiveSlide(savedLive.qa_live_id, newLog);
                this.logger.debug('Active slide cached in Redis successfully', 'Create QA Live', { qa_live_id: savedLive.qa_live_id, log_id: newLog.log_id });
            } catch (error) {
                this.logger.error('Error caching active slide for QA Live', 'Create QA Live', error);
            }

            return { success: true, data: savedLive };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Error creating QA Live and Log (Transaction Rolled Back)', 'Create QA Live', error);
            throw new InternalServerErrorException('Failed to create QA Live due to transaction error');
        } finally {
            await queryRunner.release();
        }
    }

    async updateQALive(qa_live_id: number, dto: UpdateQALiveDto) {
        const live = await this.qaLiveRepo.findOne({
            where: { qa_live_id, flag_valid: true },
        });

        if (!live) {
            throw new NotFoundException('QA Live not found');
        }

        if (dto.live_by && live.live_by !== dto.live_by) {
            throw new BadRequestException('This user cannot end this live session');
        }

        try {
            const updateData: any = {};

            if (dto.status === 'END' && live.status !== 'END') {
                updateData.status = 'END';
                updateData.ended_at = new Date();
            }

            if (Object.keys(updateData).length > 0) {
                await this.qaLiveRepo.update(qa_live_id, updateData);
            }

            if (updateData.status === 'END') {
                const endedLive: QALive = {
                    ...live,
                    status: updateData.status,
                    ended_at: updateData.ended_at,
                };
                await this.liveRoomEnded(endedLive);

                try {
                    await this.qnaRedisService.clearActiveSlide(qa_live_id);
                    await this.qnaRedisService.invalidateQuestionList(qa_live_id);
                    this.logger.debug('Cleared QA live cache successfully', 'Update QA Live', { qa_live_id });
                } catch (error) {
                    this.logger.error('Error clearing QA live cache', 'Update QA Live', error);
                }
            }

            return { success: true, message: `QA Live with ID ${qa_live_id} updated successfully` };
        } catch (error) {
            this.logger.error(`Error updating QA Live with ID ${qa_live_id}`, 'Update QA Live', error);
            throw new InternalServerErrorException('Failed to update QA Live');
        }
    }

    async findQALiveLogById(log_id: number) {
        const qaLiveLog = await this.qaLiveLogRepo.findOne({
            where: { log_id, flag_valid: true },
        });

        if (!qaLiveLog) {
            throw new NotFoundException(`QA Live Log with ID ${log_id} not found`);
        }

        return { success: true, data: qaLiveLog };
    }

    async searchQALiveLog(dto: SearchQALiveLogDto) {
        const hasInput =
            dto.log_id ||
            dto.qa_live_id ||
            dto.post_id ||
            dto.attachment_id ||
            dto.opened_at ||
            dto.closed_at ||
            typeof dto.flag_valid === 'boolean';

        if (!hasInput) {
            throw new BadRequestException('No value input!');
        }

        try {
            const query = this.qaLiveLogRepo.createQueryBuilder('qa_live_log');

            query.leftJoinAndMapOne(
                'qa_live_log.post_in_class',
                PostInClass,
                'pic',
                'qa_live_log.post_id = pic.post_id AND pic.flag_valid = true'
            );
            query.leftJoinAndMapOne(
                'qa_live_log.post_content',
                PostContent,
                'pc',
                'pic.post_content_id = pc.post_content_id AND pc.flag_valid = true'
            );
            query.leftJoinAndMapOne(
                'qa_live_log.post_attachment',
                PostAttachment,
                'pa',
                'qa_live_log.attachment_id = pa.attachment_id AND pa.flag_valid = true'
            );

            if (dto.log_id) {
                query.andWhere('qa_live_log.log_id = :log_id', { log_id: dto.log_id });
            }
            if (dto.qa_live_id) {
                query.andWhere('qa_live_log.qa_live_id = :qa_live_id', { qa_live_id: dto.qa_live_id });
            }
            if (dto.post_id) {
                query.andWhere('qa_live_log.post_id = :post_id', { post_id: dto.post_id });
            }
            if (dto.attachment_id) {
                query.andWhere('qa_live_log.attachment_id = :attachment_id', { attachment_id: dto.attachment_id });
            }
            if (dto.opened_at) {
                query.andWhere('qa_live_log.opened_at >= :opened_at', { opened_at: dto.opened_at });
            }
            if (dto.closed_at) {
                query.andWhere('qa_live_log.closed_at <= :closed_at', { closed_at: dto.closed_at });
            }
            if (typeof dto.flag_valid === 'boolean') {
                query.andWhere('qa_live_log.flag_valid = :flag_valid', { flag_valid: dto.flag_valid });
            }
            if (dto.sort_by) {
                const order = dto.sort_order || 'ASC';
                query.orderBy(`qa_live_log.${dto.sort_by}`, order);
            } else {
                query.orderBy('qa_live_log.opened_at', 'DESC');
            }

            query.select([
                'qa_live_log.log_id',
                'qa_live_log.qa_live_id',
                'qa_live_log.post_id',
                'qa_live_log.attachment_id',
                'qa_live_log.opened_at',
                'qa_live_log.closed_at',
                'qa_live_log.flag_valid',
                'pc.post_content_id',
                'pc.title',
                'pa.attachment_id',
                'pa.original_name',
            ]);

            const qaLiveLog = await query.getMany();

            return { success: true, data: qaLiveLog };
        } catch (error) {
            this.logger.error('Error searching QA Live Log', 'Search QA Live Log', error);
            throw new InternalServerErrorException('Failed to search QA Live Log');
        }
    }

    async createQALiveLog(dto: CreateQALiveLogDto) {
        if (
            !dto.qa_live_id ||
            !dto.post_id ||
            !dto.attachment_id
        ) {
            throw new BadRequestException('QA Live ID, Post ID, and Attachment ID are required.');
        }

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        let savedLog: QALiveLog;

        try {
            const currentTime = new Date();

            const currentActiveLog = await queryRunner.manager.findOne(QALiveLog, {
                where: {
                    qa_live_id: dto.qa_live_id,
                    closed_at: IsNull(),
                    flag_valid: true,
                },
            });

            if (currentActiveLog) {
                if (currentActiveLog.post_id === dto.post_id && currentActiveLog.attachment_id === dto.attachment_id) {
                    await queryRunner.rollbackTransaction();
                    return {
                        success: true,
                        message: 'Already presenting this file',
                        data: currentActiveLog
                    };
                }

                currentActiveLog.closed_at = currentTime;
                await queryRunner.manager.save(currentActiveLog);
            }

            const newLog = queryRunner.manager.create(QALiveLog, {
                qa_live_id: dto.qa_live_id,
                post_id: dto.post_id,
                attachment_id: dto.attachment_id,
                opened_at: currentTime,
                flag_valid: true,
            });

            savedLog = await queryRunner.manager.save(newLog);
            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error('Error creating QA Live Log (Transaction Rolled Back)', 'Create QA Live Log', error);
            throw new InternalServerErrorException('Failed to create QA Live Log due to transaction error');
        } finally {
            await queryRunner.release();
        }

        try {
            await this.qnaRedisService.setActiveSlide(dto.qa_live_id, savedLog);
            await this.fileChanged(dto.qa_live_id, savedLog!);
            this.logger.debug('Active slide cached and event published successfully', 'Create QA Live Log', { qa_live_id: dto.qa_live_id, log_id: savedLog.log_id });
        } catch (error) {
            this.logger.error('Error publishing QA file changed event', 'Create QA Live Log', error);
        }

        return { success: true, data: savedLog };
    }

    async getCurrentLog(qa_live_id: number) {
        try {
            const cachedLog = await this.qnaRedisService.getActiveSlide(qa_live_id);
            this.logger.debug('Fetched active slide from Redis', 'Get Current QA Live Log', { qa_live_id, cachedLog });

            if (cachedLog) {
                return { success: true, data: cachedLog };
            }

            const currentLog = await this.qaLiveLogRepo.findOne({
                where: {
                    qa_live_id,
                    closed_at: IsNull(),
                    flag_valid: true,
                },
            });

            if (!currentLog) {
                throw new NotFoundException(`No active log found for QA Live ID ${qa_live_id}`);
            }

            await this.qnaRedisService.setActiveSlide(qa_live_id, currentLog);

            return { success: true, data: currentLog };
        } catch (error) {
            this.logger.error(`Error fetching current log for QA Live ID ${qa_live_id}`, 'Get Current QA Live Log', error);
            throw new InternalServerErrorException('Failed to fetch current QA Live Log');
        }
    }

    async searchSectionFiles(section_id: number, dto: SearchSectionFilesDto) {
        if (!section_id) {
            throw new BadRequestException('Section ID is required.');
        }

        if (!dto.post_id &&
            !dto.attachment_id &&
            !dto.title &&
            !dto.original_name &&
            typeof dto.flag_valid !== 'boolean'
        ) {
            throw new BadRequestException('At least one search parameter is required.');
        }

        try {
            const query = this.dataSource
                .getRepository(PostInClass)
                .createQueryBuilder('pic')

            query.where('pic.section_id = :section_id', { section_id })
                .andWhere('pic.flag_valid = true');

            query.leftJoinAndMapOne(
                'pic.post_content',
                PostContent,
                'pc',
                'pc.post_content_id = pic.post_content_id AND pc.flag_valid = true'
            );

            query.innerJoinAndMapMany(
                'pic.attachments',
                PostAttachment,
                'pa',
                `pa.post_content_id = pc.post_content_id AND pa.flag_valid = true AND pa.file_type ILIKE '%pdf%'`
            );

            if (dto.post_id) {
                query.andWhere('pic.post_id = :post_id', { post_id: dto.post_id });
            }

            if (dto.attachment_id) {
                query.andWhere('pa.attachment_id = :attachment_id', { attachment_id: dto.attachment_id });
            }

            if (dto.title?.trim()) {
                query.andWhere('pc.title ILIKE :title', { title: `%${dto.title.trim()}%` });
            }

            if (dto.original_name?.trim()) {
                query.andWhere('pa.original_name ILIKE :original_name', {
                    original_name: `%${dto.original_name.trim()}%`,
                });
            }

            if (typeof dto.flag_valid === 'boolean') {
                query.andWhere('pa.flag_valid = :attachment_flag_valid', {
                    attachment_flag_valid: dto.flag_valid,
                });
            }

            query.select([
                'pic.post_id',
                'pic.section_id',
                'pc.post_content_id',
                'pc.title',
                'pc.created_at',
                'pa.attachment_id',
                'pa.file_url',
                'pa.original_name',
                'pa.file_type'
            ]);

            query.orderBy('pc.created_at', 'DESC');

            const files = await query.getMany();

            return { success: true, data: files };
        } catch (error) {
            this.logger.error(`Error searching files for Section ID ${section_id}`, 'Search Section Files', error);
            throw new InternalServerErrorException('Failed to search section files');
        }
    }

    private async liveRoomStarted(liveRoom: QALive): Promise<void> {
        const eventMessage: QALiveStartEvent = {
            type: 'QA_LIVE_STARTED',
            payload: {
                qa_live_id: liveRoom.qa_live_id,
                section_id: liveRoom.section_id,
                live_by: liveRoom.live_by,
                started_at: liveRoom.started_at || new Date(),
            },
        };

        this.logger.debug(
            'Publishing message to RabbitMQ:',
            'QALiveService',
            eventMessage,
        );

        await this.rabbitMQService.publish(
            'linklian_events',
            `qa_live.${liveRoom.qa_live_id}.started`,
            eventMessage
        );

        this.logger.debug('Message published to RabbitMQ successfully', 'QALiveService', eventMessage);
    }

    private async liveRoomEnded(liveRoom: QALive): Promise<void> {
        const eventMessage: QALiveEndEvent = {
            type: 'QA_LIVE_ENDED',
            payload: {
                qa_live_id: liveRoom.qa_live_id,
                section_id: liveRoom.section_id,
                live_by: liveRoom.live_by,
                ended_at: liveRoom.ended_at || new Date(),
            },
        };
        await this.rabbitMQService.publish(
            'linklian_events',
            `qa_live.${liveRoom.qa_live_id}.ended`,
            eventMessage
        );

        this.logger.debug('Message published to RabbitMQ successfully', 'QALiveService', eventMessage);
    }

    private async fileChanged(qaLiveId: number, log: QALiveLog): Promise<void> {
        const eventMessage: FileChangeEvent = {
            type: 'FILE_CHANGED',
            payload: {
                qa_live_id: qaLiveId,
                post_id: log.post_id,
                attachment_id: log.attachment_id,
                opened_at: log.opened_at,
            }
        };

        this.logger.debug(
            'Publishing message to RabbitMQ:',
            'QALiveService',
            eventMessage,
        );

        await this.rabbitMQService.publish(
            'linklian_events',
            `qa_live.${qaLiveId}.file_changed`,
            eventMessage
        );

        this.logger.debug('Message published to RabbitMQ successfully', 'QALiveService', eventMessage);
    }
}