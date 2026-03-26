import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AiChatService } from './ai-chat.service';
import {
  CreateAiChatDto,
  CreateAiMessageDto,
  //SearchAiChatDto,
  SearchAiMessageDto,
  UpdateAiChatDto,
} from './dto/ai-chat.dto';

@ApiTags('AI Chat')
@Controller('ai-chat')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) { }

  // @Get()
  // @ApiOperation({ summary: 'Search AI chats' })
  // @ApiResponse({ status: 200, description: 'Success' })
  // @ApiResponse({ status: 400, description: 'No value input' })
  // async getAiChats(@Query() dto: SearchAiChatDto) {
  //   return this.aiChatService.searchAiChat(dto);
  // }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create AI chat' })
  @ApiBody({ type: CreateAiChatDto })
  @ApiResponse({ status: 201, description: 'AI chat created successfully' })
  async createAiChat(@Body() dto: CreateAiChatDto, @Req() req) {
    const userId = Number(req.headers['x-user-id']);
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }

    return this.aiChatService.createAiChat(dto, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update AI chat' })
  @ApiParam({ name: 'id', type: Number, description: 'AI chat ID' })
  @ApiBody({ type: UpdateAiChatDto })
  @ApiResponse({ status: 200, description: 'AI chat updated successfully' })
  async updateAiChat(@Param('id') id: number, @Body() dto: UpdateAiChatDto) {
    return this.aiChatService.updateAiChat(Number(id), dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete AI chat (soft delete)' })
  @ApiParam({ name: 'id', type: Number, description: 'AI chat ID' })
  @ApiResponse({ status: 200, description: 'AI chat deleted successfully' })
  async deleteAiChat(@Param('id') id: number) {
    return this.aiChatService.deleteAiChat(Number(id));
  }

  @Get('messages')
  @ApiOperation({ summary: 'Search AI messages' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'No value input' })
  async getAiMessages(@Query() dto: SearchAiMessageDto) {
    return this.aiChatService.searchAiMessages(dto);
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create AI message' })
  @ApiBody({ type: CreateAiMessageDto })
  @ApiResponse({ status: 201, description: 'AI message created successfully' })
  async createAiMessage(@Body() dto: CreateAiMessageDto, @Req() req) {
    const userId = Number(req.headers['x-user-id']);
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }
    //return this.aiChatService.createAiMessage(dto, userId);
    return this.aiChatService.createAiMessage(dto, userId);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete AI message (soft delete)' })
  @ApiParam({ name: 'id', type: Number, description: 'AI message ID' })
  @ApiResponse({ status: 200, description: 'AI message deleted successfully' })
  async deleteAiMessage(@Param('id') id: number) {
    return this.aiChatService.deleteAiMessage(Number(id));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get AI chat by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'AI chat ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'AI chat not found' })
  async getAiChatById(@Param('id') id: number, @Req() req) {
    const userId = Number(req.headers['x-user-id']);
    if (!userId) {
      throw new UnauthorizedException('User not found');
    }

    return this.aiChatService.getAiChat(Number(id), userId);
  }

  @Get()
  async getAiChats(@Req() req) {
    const userId = Number(req.headers['x-user-id']);

    if (!userId) {
      throw new UnauthorizedException('User not found');
    }

    return this.aiChatService.getAll(userId);
  }
}
