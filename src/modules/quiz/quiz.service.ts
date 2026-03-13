import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from '../ai-chat/entities/quiz.entity';
import { CreateQuizDto } from '../ai-chat/dto/ai-chat.dto';
import { AiChatService } from '../ai-chat/ai-chat.service';

@Injectable()
export class QuizService {

  constructor(
    @InjectRepository(Quiz)
    private quizRepo: Repository<Quiz>,

    private aiChatService: AiChatService,
  ) {}

  async generateQuiz(dto: CreateQuizDto) {

    const aiChat = await this.aiChatService.getAiChat(dto.ai_chat_id);

    if (!aiChat) {
      throw new NotFoundException('AI chat not found');
    }

    const quizDetail = {
      questions: [
        {
          question: 'Example question?',
          choices: ['A','B','C','D'],
          answer: 'A'
        }
      ]
    };

    const quiz = this.quizRepo.create({
      ai_chat_id: dto.ai_chat_id,
      quiz_detail: quizDetail,
      difficulty: dto.difficulty,
      question_count: dto.question_count,
    });

    return this.quizRepo.save(quiz);
  }
}