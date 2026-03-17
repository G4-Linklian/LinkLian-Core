import { Controller, Post, Body, Get, Param, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuizAttemptDto } from './dto/create-quiz-attempt.dto';

@ApiTags('Quiz')
@Controller('quiz')
export class QuizController {

  constructor(private quizService: QuizService) { }

  @Post()
  async generateQuiz(@Body() dto: CreateQuizDto) {
    return this.quizService.generateQuiz(dto);
  }

  @Get('by-chat/:aiChatId')
  async getQuizByChat(@Param('aiChatId') aiChatId: number) {
    return this.quizService.getQuizByChat(Number(aiChatId));
  }
  @Post('attempt')
  async saveAttempt(
    @Body() dto: CreateQuizAttemptDto,
    @Req() req,
  ) {
    const userId = Number(req.headers['x-user-id']);

    console.log("USER ID:", userId);

    if (!userId) {
      throw new UnauthorizedException('User not found');
    }

    return this.quizService.saveAttempt(dto, userId);
  }

  @Get('attempt/:quizId')
  async getUserAttempt(
    @Param('quizId') quizId: number,
    @Req() req,
  ) {
    const userId = Number(req.headers['x-user-id']);

    console.log("USER ID:", userId);

    if (!userId) {
      throw new UnauthorizedException('User not found');
    }

    return this.quizService.getUserAttempt(quizId, userId);
  }

}