import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AiChat } from './entities/ai-chat.entity';
// import { Quiz } from './entities/quiz.entity';
import { CreateAiChatDto } from './dto/ai-chat.dto';

@Injectable()
export class AiChatService {
    constructor(
        @InjectRepository(AiChat)
        private aiChatRepo: Repository<AiChat>,

        // @InjectRepository(Quiz)
        // private quizRepo: Repository<Quiz>,

        private dataSource: DataSource,
    ) { }


    async generateSummary(dto: CreateAiChatDto) {
        const existing = await this.aiChatRepo.findOne({
            where: { post_content_id: dto.post_content_id },
        });

        if (existing) {

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
                [dto.post_content_id],
            );

            const postData = post[0];

            return {
                ai_chat_id: existing.ai_chat_id,
                title: postData.title,
                content: postData.content,
                summary: existing.summary_text,
                attachments: postData.attachments,
            };
        }


        const post = await this.dataSource.query(
            `
            SELECT
                pc.post_content_id,
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
                AND pc.post_type = 'announcement'
                AND pc.flag_valid = true
            GROUP BY pc.post_content_id
            `,
            [dto.post_content_id],
        );
        if (!post.length) {
            throw new NotFoundException('Announcement post not found');
        }

        const postData = post[0];

        const summary = `Summary of ${postData.title}`;

        const aiChat = this.aiChatRepo.create({
            post_content_id: dto.post_content_id,
            chat_title: postData.title,
            summary_text: summary,
        });

        await this.aiChatRepo.save(aiChat);

        return {
            ai_chat_id: aiChat.ai_chat_id,
            title: postData.title,
            content: postData.content,
            summary: summary,
            attachments: postData.attachments,
        };
    }

    // async generateQuiz(dto: CreateQuizDto) {

    //     const aiChat = await this.aiChatRepo.findOne({
    //         where: { ai_chat_id: dto.ai_chat_id },
    //     });

    //     if (!aiChat) {
    //         throw new NotFoundException('AI chat not found');
    //     }

    //     const quizDetail = {
    //         questions: [
    //             {
    //                 question: 'Example question?',
    //                 choices: ['A', 'B', 'C', 'D'],
    //                 answer: 'A',
    //             },
    //         ],
    //     };

    //     const quiz = this.quizRepo.create({
    //         ai_chat_id: dto.ai_chat_id,
    //         quiz_detail: quizDetail,
    //         difficulty: dto.difficulty,
    //         question_count: dto.question_count,
    //     });

    //     await this.quizRepo.save(quiz);

    //     return quiz;
    // }

    async getAiChat(id: number) {
        return this.aiChatRepo.findOne({
            where: { ai_chat_id: id },
        });
    }

    async getAll() {
        return this.aiChatRepo.find({
            order: { created_at: 'DESC' },
        });
    }
}