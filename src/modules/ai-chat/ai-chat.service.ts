import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { AiChat } from './entities/ai-chat.entity';
import { AiMessage } from './entities/ai-message.entity';
import {
    CreateAiChatDto,
    CreateAiMessageDto,
    SearchAiChatDto,
    SearchAiMessageDto,
    UpdateAiChatDto,
} from './dto/ai-chat.dto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class AiChatService {
    constructor(
        @InjectRepository(AiChat)
        private readonly aiChatRepo: Repository<AiChat>,
        @InjectRepository(AiMessage)
        private readonly aiMessageRepo: Repository<AiMessage>,
        private readonly dataSource: DataSource,
        private readonly logger: AppLogger,
        @Inject(forwardRef(() => AiService))
        private readonly aiService: AiService,
    ) { }

    private async ensureActiveUser(userId: number) {
        const user = await this.dataSource.query(
            `
            SELECT 1
            FROM user_sys
            WHERE user_sys_id = $1
            `,
            [userId],
        );

        if (!user.length) {
            throw new ForbiddenException('Account deleted');
        }
    }

    async findAiChatById(id: number) {
        const chat = await this.aiChatRepo.findOne({
            where: { ai_chat_id: id },
        });

        if (!chat) {
            throw new NotFoundException('AI chat not found');
        }

        return { success: true, data: chat };
    }

    async searchAiChat(dto: SearchAiChatDto) {
        const hasInput =
            dto.ai_chat_id ||
            dto.post_content_id ||
            dto.chat_title ||
            typeof dto.flag_valid === 'boolean';

        if (!hasInput) {
            throw new BadRequestException('No value input!');
        }

        const query = this.aiChatRepo
            .createQueryBuilder('ac')
            .select('ac.*')
            .addSelect('COUNT(*) OVER()', 'total_count');

        if (dto.ai_chat_id) {
            query.andWhere('ac.ai_chat_id = :aiChatId', { aiChatId: dto.ai_chat_id });
        }

        if (dto.post_content_id) {
            query.andWhere('ac.post_content_id = :postContentId', {
                postContentId: dto.post_content_id,
            });
        }

        if (dto.chat_title) {
            query.andWhere('ac.chat_title ILIKE :chatTitle', {
                chatTitle: `%${dto.chat_title}%`,
            });
        }

        if (typeof dto.flag_valid === 'boolean') {
            query.andWhere('ac.flag_valid = :flagValid', { flagValid: dto.flag_valid });
        }

        if (dto.sort_by) {
            const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            query.orderBy(`ac.${dto.sort_by}`, order);
        }

        if (dto.limit) query.limit(dto.limit);
        if (dto.offset) query.offset(dto.offset);

        try {
            const result = await query.getRawMany();
            return { success: true, data: result };
        } catch (error) {
            this.logger.error('Error searching ai_chat', 'SearchAiChat', error);
            throw new InternalServerErrorException('Error fetching AI chats');
        }
    }

    // async createAiChat(dto: CreateAiChatDto) {
    //     try {
    //         const newChat = this.aiChatRepo.create({
    //             post_content_id: dto.post_content_id,
    //             chat_title: dto.chat_title,
    //             summary_text: dto.summary_text,
    //             created_at: new Date(),
    //             flag_valid: true,
    //         });

    //         const saved = await this.aiChatRepo.save(newChat);

    //         return {
    //             success: true,
    //             message: 'AI chat created successfully!',
    //             data: saved,
    //         };
    //     } catch (error) {
    //         this.logger.error('Error creating ai_chat', 'CreateAiChat', error);
    //         throw new InternalServerErrorException('Error creating AI chat');
    //     }
    // }
    async createAiChat(dto: CreateAiChatDto, userId: number) {
        await this.ensureActiveUser(userId);

        let existing = await this.aiChatRepo.findOne({
            where: {
                post_content_id: dto.post_content_id,
                user_sys_id: userId,
                flag_valid: true,
            },
        });

        if (existing) {
            return {
                ai_chat_id: existing.ai_chat_id,
                title: existing.chat_title,
                document_title: existing.chat_title,
                summary: existing.summary_text,
            };
        }

        const post = await this.dataSource.query(
            `
    SELECT pc.title, pc.content
    FROM post_content pc
    WHERE pc.post_content_id = $1
    `,
            [dto.post_content_id],
        );

        if (!post.length) {
            throw new NotFoundException('Post not found');
        }

        const postData = post[0];

        const aiResult = await this.aiService.postSummary({
            post_content_id: dto.post_content_id,
        });

        let summary =
            aiResult?.data?.final_summary ||
            aiResult?.data?.summary ||
            aiResult?.data?.summary_text;

        if (!summary) {
            throw new BadRequestException('AI summary not ready');
        }

        const documentTitle =
            aiResult?.data?.document_title || postData.title;

        const chat = await this.aiChatRepo.save({
            user_sys_id: userId,
            post_content_id: dto.post_content_id,
            chat_title: documentTitle,
            summary_text: summary,
            created_at: new Date(),
            flag_valid: true,
        });

        return {
            ai_chat_id: chat.ai_chat_id,
            title: chat.chat_title,
            document_title: chat.chat_title,
            post_title: postData.title,
            content: postData.content,
            summary: summary,
        };
    }

    async updateAiChat(id: number, dto: UpdateAiChatDto) {
        const existing = await this.aiChatRepo.findOne({ where: { ai_chat_id: id } });

        if (!existing) {
            throw new NotFoundException('AI chat not found');
        }

        const fieldsToUpdate: Partial<AiChat> = {};

        if (dto.chat_title !== undefined) {
            fieldsToUpdate.chat_title = dto.chat_title;
        }
        if (dto.summary_text !== undefined) {
            fieldsToUpdate.summary_text = dto.summary_text;
        }
        if (dto.flag_valid !== undefined) {
            fieldsToUpdate.flag_valid = dto.flag_valid;
        }

        if (Object.keys(fieldsToUpdate).length === 0) {
            throw new BadRequestException('No fields to update!');
        }

        try {
            await this.aiChatRepo.update({ ai_chat_id: id }, fieldsToUpdate);
            return { success: true, message: 'AI chat updated successfully!' };
        } catch (error) {
            this.logger.error('Error updating ai_chat', 'UpdateAiChat', error);
            throw new InternalServerErrorException('Error updating AI chat');
        }
    }

    async deleteAiChat(id: number) {
        const existing = await this.aiChatRepo.findOne({ where: { ai_chat_id: id } });

        if (!existing) {
            throw new NotFoundException('AI chat not found');
        }

        try {
            await this.aiChatRepo.update({ ai_chat_id: id }, { flag_valid: false });
            return { success: true, message: 'AI chat deleted successfully!' };
        } catch (error) {
            this.logger.error('Error deleting ai_chat', 'DeleteAiChat', error);
            throw new InternalServerErrorException('Error deleting AI chat');
        }
    }

    async searchAiMessages(dto: SearchAiMessageDto) {
        const hasInput =
            dto.ai_message_id ||
            dto.ai_chat_id ||
            dto.role ||
            dto.content ||
            typeof dto.flag_valid === 'boolean';

        if (!hasInput) {
            throw new BadRequestException('No value input!');
        }

        const query = this.aiMessageRepo
            .createQueryBuilder('am')
            .select('am.*')
            .addSelect('COUNT(*) OVER()', 'total_count');

        if (dto.ai_message_id) {
            query.andWhere('am.ai_message_id = :aiMessageId', {
                aiMessageId: dto.ai_message_id,
            });
        }

        if (dto.ai_chat_id) {
            query.andWhere('am.ai_chat_id = :aiChatId', {
                aiChatId: dto.ai_chat_id,
            });
        }

        if (dto.role) {
            query.andWhere('am.role = :role', { role: dto.role });
        }

        if (dto.content) {
            query.andWhere('am.content ILIKE :content', {
                content: `%${dto.content}%`,
            });
        }

        if (typeof dto.flag_valid === 'boolean') {
            query.andWhere('am.flag_valid = :flagValid', { flagValid: dto.flag_valid });
        }

        if (dto.sort_by) {
            const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            query.orderBy(`am.${dto.sort_by}`, order);
        }

        if (dto.limit) query.limit(dto.limit);
        if (dto.offset) query.offset(dto.offset);

        try {
            const result = await query.getRawMany();
            return { success: true, data: result };
        } catch (error) {
            this.logger.error('Error searching ai_message', 'SearchAiMessages', error);
            throw new InternalServerErrorException('Error fetching AI messages');
        }
    }

    async createAiMessage(dto: CreateAiMessageDto, userId: number) {
        await this.ensureActiveUser(userId);

        const chat = await this.aiChatRepo.findOne({
            where: {
                ai_chat_id: dto.ai_chat_id,
                user_sys_id: userId,
                flag_valid: true,
            },
        });

        if (!chat) {
            throw new NotFoundException('AI chat not found');
        }

        try {
            const aiRes: any = await this.aiService.qaChat({
                ai_chat_id: Number(dto.ai_chat_id),
                question: dto.question,
                post_content_id: Number(chat.post_content_id),
            });

            const answer =
                aiRes?.result ||
                aiRes?.data?.result ||
                aiRes;

            if (!answer) {
                throw new BadRequestException('AI answer not found');
            }

            await this.createQaMessagePairTransaction(
                dto.ai_chat_id,
                dto.question,
                answer,
            );

            return {
                success: true,
                message: 'AI message created successfully!',
                data: answer,
            };
        } catch (error) {
            this.logger.error('Error creating ai_message', 'CreateAiMessage', error);
            throw new InternalServerErrorException('Error creating AI message');
        }
    }

    async createQaMessagePairTransaction(
        aiChatId: number,
        userQuestion: string,
        assistantAnswer: string,
    ) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const chat = await queryRunner.manager.findOne(AiChat, {
                where: { ai_chat_id: aiChatId, flag_valid: true },
            });

            if (!chat) {
                throw new NotFoundException('AI chat not found');
            }

            const userMessage = queryRunner.manager.create(AiMessage, {
                ai_chat_id: String(aiChatId),
                role: 'user',
                content: userQuestion,
                created_at: new Date(),
                flag_valid: true,
            });

            const systemMessage = queryRunner.manager.create(AiMessage, {
                ai_chat_id: String(aiChatId),
                role: 'system',
                content: assistantAnswer,
                created_at: new Date(),
                flag_valid: true,
            });

            const savedUserMessage = await queryRunner.manager.save(AiMessage, userMessage);
            const savedSystemMessage = await queryRunner.manager.save(AiMessage, systemMessage);

            await queryRunner.commitTransaction();

            return {
                success: true,
                data: {
                    user_message: savedUserMessage,
                    system_message: savedSystemMessage,
                },
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(
                'Error creating QA message pair in transaction',
                'CreateQaMessagePairTransaction',
                error,
            );

            if (error instanceof NotFoundException) {
                throw error;
            }

            throw new InternalServerErrorException('Error creating QA messages');
        } finally {
            await queryRunner.release();
        }
    }

    async deleteAiMessage(id: number) {
        const existing = await this.aiMessageRepo.findOne({
            where: { ai_message_id: String(id) },
        });

        if (!existing) {
            throw new NotFoundException('AI message not found');
        }

        try {
            await this.aiMessageRepo.update(
                { ai_message_id: String(id) },
                { flag_valid: false },
            );
            return { success: true, message: 'AI message deleted successfully!' };
        } catch (error) {
            this.logger.error('Error deleting ai_message', 'DeleteAiMessage', error);
            throw new InternalServerErrorException('Error deleting AI message');
        }
    }

    async getAiChat(id: number) {
        const chat = await this.aiChatRepo.findOne({
            where: { ai_chat_id: id, flag_valid: true },
        });

        if (!chat) {
            throw new NotFoundException("AI chat not found");
        }

        const post = await this.dataSource.query(
            `
        SELECT
            pc.title,
            pc.content,
            COALESCE(
                json_agg(
                    json_build_object(
                        'file_url', pa.file_url,
                        'file_type', pa.file_type,
                        'original_name', pa.original_name
                    )
                ) FILTER (WHERE pa.file_url IS NOT NULL),
                '[]'
            ) as attachments
        FROM post_content pc
        LEFT JOIN post_attachment pa
            ON pc.post_content_id = pa.post_content_id
        WHERE pc.post_content_id = $1
        GROUP BY pc.post_content_id
        `,
            [chat.post_content_id],
        );

        const postData = post[0];

        return {
            ai_chat_id: chat.ai_chat_id,
            post_content_id: chat.post_content_id,

            title: chat.chat_title,
            document_title: chat.chat_title,
            post_title: postData?.title ?? "",
            content: postData?.content ?? "",
            summary: chat.summary_text,
            attachments: postData?.attachments ?? [],
        };
    }
    async getAll() {
        return this.aiChatRepo.find({
            where: { flag_valid: true },
            order: { created_at: 'DESC' },
        });
    }
}
