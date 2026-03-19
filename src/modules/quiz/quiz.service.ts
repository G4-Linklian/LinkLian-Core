import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from './entities/quiz.entity';
import { AiService } from '../ai/ai.service';
import { AiChat } from '../ai-chat/entities/ai-chat.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuizAttemptDto } from './dto/create-quiz-attempt.dto';
import { QuizAttempt } from './entities/quiz-attempt.entity';

@Injectable()
export class QuizService {

  constructor(
    @InjectRepository(Quiz)
    private quizRepo: Repository<Quiz>,

    @InjectRepository(AiChat)
    private aiChatRepo: Repository<AiChat>,

    private aiService: AiService,

    @InjectRepository(QuizAttempt)
    private quizAttemptRepo: Repository<QuizAttempt>,
  ) { }

  async generateQuiz(dto: CreateQuizDto) {

    const aiChat = await this.aiChatRepo.findOne({
      where: { ai_chat_id: dto.ai_chat_id },
    });

    if (!aiChat) {
      throw new NotFoundException('AI Chat not found');
    }

    const aiResult: any = await this.aiService.quizGeneration({
      post_content_id: aiChat.post_content_id,
      difficulty: dto.difficulty,
      num_questions: dto.question_count,
    });

    const quiz = this.quizRepo.create({
      ai_chat_id: dto.ai_chat_id,
      quiz_detail: aiResult.data ?? aiResult,
      difficulty: dto.difficulty,
      question_count: dto.question_count,
    });

    return this.quizRepo.save(quiz);
  }

  async getQuizByChat(aiChatId: number) {

    const quizzes = await this.quizRepo.find({
      where: { ai_chat_id: aiChatId },
      order: { created_at: 'ASC' },
    });

    return quizzes;
  }
  async saveAttempt(dto: CreateQuizAttemptDto, userId: number) {

    const attempt = this.quizAttemptRepo.create({
      quiz_id: dto.quiz_id,
      user_sys_id: userId,
      score: dto.score,
      total: dto.total,
      answers: dto.answers ?? {},
    });

    return this.quizAttemptRepo.save(attempt);
  }
  async getUserAttempt(quizId: number, userId: number) {

    return this.quizAttemptRepo.findOne({
      where: {
        quiz_id: quizId,
        user_sys_id: userId,
      },
      order: {
        created_at: 'DESC',
      },
    });
  }
}