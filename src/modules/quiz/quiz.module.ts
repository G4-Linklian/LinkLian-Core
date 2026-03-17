import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quiz } from './entities/quiz.entity';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { AiModule } from '../ai/ai.module';
import { AiChat } from '../ai-chat/entities/ai-chat.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz, AiChat, QuizAttempt]),
    AiModule
  ],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule { }