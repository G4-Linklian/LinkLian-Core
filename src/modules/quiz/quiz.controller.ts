// import { Controller, Post, Body } from '@nestjs/common';
// import { ApiTags } from '@nestjs/swagger';
// import { QuizService } from './quiz.service';
// import { CreateQuizDto } from '../ai-chat/dto/ai-chat.dto';

// @ApiTags('Quiz')
// @Controller('quiz')
// export class QuizController {

//   constructor(private quizService: QuizService) {}

//   @Post()
//   async generateQuiz(@Body() dto: CreateQuizDto) {
//     return this.quizService.generateQuiz(dto);
//   }

// }

import { Controller, Post, Body, Get, Param, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { CreateQuizAttemptDto } from './dto/create-quiz-attempt.dto';

@ApiTags('Quiz')
@Controller('quiz')
export class QuizController {

  constructor(private quizService: QuizService) {}

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
  const userId = req.user.user_sys_id;

  return this.quizService.saveAttempt(dto, userId);
}
@Get('attempt/:quizId')
async getUserAttempt(
  @Param('quizId') quizId: number,
  @Req() req,
) {
  const userId = req.user.user_sys_id;

  return this.quizService.getUserAttempt(quizId, userId);
}

}