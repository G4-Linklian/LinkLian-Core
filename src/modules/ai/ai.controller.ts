import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { PostSummaryDto, QuizGenerationDto } from './dto/post-summary.dto';
import { QaChatDto } from './dto/qa-chat.dto';
import { ClearChatSessionDto } from './dto/clear-chat-session.dto';

@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('post-summary')
  @ApiOperation({ summary: 'Generate AI summary for a post' })
  @ApiResponse({ status: 200, description: 'Summary generated successfully' })
  postSummary(@Body() dto: PostSummaryDto) {
    return this.aiService.postSummary(dto);
  }

  @Post('quiz-generation')
  @ApiOperation({ summary: 'Generate AI quiz for a post' })
  @ApiResponse({ status: 200, description: 'Quiz generated successfully' })
  quizGeneration(@Body() dto: QuizGenerationDto) {
    return this.aiService.quizGeneration(dto);
  }

  @Post('qa-chat')
  @ApiOperation({ summary: 'Ask question in AI chat context' })
  @ApiResponse({ status: 200, description: 'QA chat response generated successfully' })
  qaChat(@Body() dto: QaChatDto) {
    return this.aiService.qaChat(dto);
  }

  @Post('qa-chat/clear-session')
  @ApiOperation({ summary: 'Clear AI chat Redis session keys' })
  @ApiResponse({ status: 200, description: 'QA chat Redis session cleared successfully' })
  clearQaChatSession(@Body() dto: ClearChatSessionDto) {
    return this.aiService.clearQaChatSession(dto);
  }
}
