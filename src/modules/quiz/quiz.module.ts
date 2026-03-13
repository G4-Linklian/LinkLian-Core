import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quiz } from '../ai-chat/entities/quiz.entity';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { AiChatModule } from '../ai-chat/ai-chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quiz]),
    AiChatModule
  ],
  controllers: [QuizController],
  providers: [QuizService],
})
export class QuizModule {}