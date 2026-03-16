import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AiChat } from './entities/ai-chat.entity';
// import { Quiz } from './entities/quiz.entity';
import { CreateAiChatDto } from './dto/ai-chat.dto';
import { AiService } from '../ai/ai.service';

@Injectable()
export class AiChatService {
    constructor(
        @InjectRepository(AiChat)
        private aiChatRepo: Repository<AiChat>,

        // @InjectRepository(Quiz)
        // private quizRepo: Repository<Quiz>,

        private dataSource: DataSource,
        private aiService: AiService,
    ) { }

      private extractDocumentTitle(aiResult: any, fallbackTitle: string) {
        return (
          aiResult?.data?.document_title ||
          aiResult?.data?.title ||
          fallbackTitle
        );
      }


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

            if (!existing.chat_title || existing.chat_title === postData.title) {
              const aiResult = await this.aiService.postSummary({
                post_content_id: dto.post_content_id,
              });

              const documentTitle = this.extractDocumentTitle(aiResult, postData.title);

              if (documentTitle && documentTitle !== existing.chat_title) {
                existing.chat_title = documentTitle;
                await this.aiChatRepo.save(existing);
              }
            }

            return {
                ai_chat_id: existing.ai_chat_id,
                title: existing.chat_title || postData.title,
                document_title: existing.chat_title || postData.title,
                post_title: postData.title,
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
        const aiResult = await this.aiService.postSummary({
  post_content_id: dto.post_content_id,
});

console.log("AI RESULT FROM SERVICE:", aiResult);
let summary = '';

if (aiResult?.data?.final_summary) {
  summary = aiResult.data.final_summary;

} else if (aiResult?.data?.summary) {
  summary = aiResult.data.summary;

} else if (aiResult?.data?.summary_text) {
  summary = aiResult.data.summary_text;

} else {
  return {
    success: false,
    message: "AI summary still processing"
  };
}

if (!summary || summary.startsWith("Summary of")) {
  return {
    success: false,
    message: "AI summary not ready"
  };
}

const documentTitle = this.extractDocumentTitle(aiResult, postData.title);

const aiChat = this.aiChatRepo.create({
  post_content_id: dto.post_content_id,
  chat_title: documentTitle,
  summary_text: summary,
});

await this.aiChatRepo.save(aiChat);

// let summary = '';

// if (aiResult?.data?.final_summary) {
//   summary = aiResult.data.final_summary;
// } else if (aiResult?.data?.summary) {
//   summary = aiResult.data.summary;
// } else if (aiResult?.data?.summary_text) {
//   summary = aiResult.data.summary_text;
// } else {
//   summary = `Summary of ${postData.title}`;
// }

// console.log("FINAL SUMMARY:", summary);
//         // const aiResult = await this.aiService.postSummary({
//         //     post_content_id: dto.post_content_id,
//         // });
//         // console.log("AI RESULT FROM SERVICE:", aiResult);

//         // if (!aiResult.success) {
//         //     return aiResult;
//         // }

//         // const summary =
//         //     aiResult?.data?.final_summary ||
//         //     aiResult?.data?.summary ||
//         //     aiResult?.data?.summary_text ||
//         //     '';
//         // console.log("FINAL SUMMARY:", summary);
//         const aiChat = this.aiChatRepo.create({
//             post_content_id: dto.post_content_id,
//             chat_title: postData.title,
//             summary_text: summary,
//         });

//         await this.aiChatRepo.save(aiChat);
        // const aiResult = await this.aiService.postSummary({
        //     post_content_id: dto.post_content_id,
        // });

        // if (!aiResult.success) {
        //     return aiResult;
        // }

        // const summary =
        //     aiResult?.data?.summary ||
        //     aiResult?.data?.summary_text ||
        //     JSON.stringify(aiResult.data);

        // const aiChat = this.aiChatRepo.create({
        //     post_content_id: dto.post_content_id,
        //     chat_title: postData.title,
        //     summary_text: summary,
        // });

        // await this.aiChatRepo.save(aiChat);

        // const aiResult = await this.aiService.postSummary({
        //     post_content_id: dto.post_content_id,
        // });

        // const summary =
        //     aiResult?.data?.summary ||
        //     aiResult?.data?.summary_text ||
        //     JSON.stringify(aiResult.data);

        // // const aiChat = this.aiChatRepo.create({
        // //     post_content_id: dto.post_content_id,
        // //     chat_title: postData.title,
        // //     summary_text: summary,
        // // });
        // const aiChat = this.aiChatRepo.create({
        //     post_content_id: dto.post_content_id,
        //     chat_title: postData.title,
        //     summary_text: summary,
        // });

        // await this.aiChatRepo.save(aiChat);

        return {
            ai_chat_id: aiChat.ai_chat_id,
            title: aiChat.chat_title,
            document_title: aiChat.chat_title,
            post_title: postData.title,
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

    const chat = await this.aiChatRepo.findOne({
        where: { ai_chat_id: id },
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

  if (!chat.chat_title || chat.chat_title === postData.title) {
    const aiResult = await this.aiService.postSummary({
      post_content_id: chat.post_content_id,
    });

    const documentTitle = this.extractDocumentTitle(aiResult, postData.title);

    if (documentTitle && documentTitle !== chat.chat_title) {
      chat.chat_title = documentTitle;
      await this.aiChatRepo.save(chat);
    }
  }

    return {
        ai_chat_id: chat.ai_chat_id,
      title: chat.chat_title || postData.title,
      document_title: chat.chat_title || postData.title,
      post_title: postData.title,
        content: postData.content,
        summary: chat.summary_text,
        attachments: postData.attachments,
    };
}

    async getAll() {
        return this.aiChatRepo.find({
            order: { created_at: 'DESC' },
        });
    }
}