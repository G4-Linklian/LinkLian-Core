import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from '../ai-chat/dto/ai-chat.dto';

@ApiTags('Quiz')
@Controller('quiz')
export class QuizController {

  constructor(private quizService: QuizService) {}

  @Post()
  async generateQuiz(@Body() dto: CreateQuizDto) {
    return this.quizService.generateQuiz(dto);
  }

}