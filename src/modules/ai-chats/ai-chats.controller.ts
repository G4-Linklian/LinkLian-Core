import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateAiChatDto, CreateQuizDto } from './dto/ai-chat.dto';
import { AiChatService } from './ai-chat.service';

@ApiTags('AI Chat')
@Controller('ai-chat')
export class AiChatController {
    constructor(private readonly aiChatService: AiChatService) { }

    @Post('summary')
    @ApiOperation({ summary: 'Generate AI summary from announcement post' })
    @ApiResponse({ status: 201, description: 'Summary generated successfully' })
    async generateSummary(@Body() dto: CreateAiChatDto) {
        return this.aiChatService.generateSummary(dto);
    }

    // @Post('quiz')
    // @ApiOperation({ summary: 'Generate quiz from AI summary' })
    // @ApiResponse({ status: 201, description: 'Quiz generated successfully' })
    // async generateQuiz(@Body() dto: CreateQuizDto) {
    //     return this.aiChatService.generateQuiz(dto);
    // }

    @Get(':id')
    @ApiOperation({ summary: 'Get AI chat summary by id' })
    @ApiResponse({ status: 200, description: 'AI chat retrieved successfully' })
    async getAiChat(@Param('id', ParseIntPipe) id: number) {
        return this.aiChatService.getAiChat(id);
    }

    @Get()
    async getAll() {
        return this.aiChatService.getAll();
    }
}