// chat.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  CreateChatDto,
  SearchChatDto,
  CreateMessageDto,
  SearchMessageDto,
  SearchUserForChatDto,
} from './dto/chat.dto';
import { UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  // ========== Chat Endpoints ==========

  @Get()
  @ApiOperation({
    summary: 'Search chats',
    description: 'Search chats with filters and user info',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'No value input' })
  async getChat(@Query() dto: SearchChatDto) {
    const data = await this.chatService.searchChat(dto);
    return data;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create chat',
    description: 'Create a new chat between two users',
  })
  @ApiBody({ type: CreateChatDto })
  @ApiResponse({ status: 201, description: 'Chat created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  async createChat(@Body() dto: CreateChatDto) {
    const result = await this.chatService.createChat(dto);
    return result;
  }

  // ========== Message Endpoints ==========

  @Get('messages')
  @ApiOperation({
    summary: 'Search messages',
    description: 'Search messages with filters',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'No value input' })
  async getMessages(@Query() dto: SearchMessageDto) {
    const data = await this.chatService.searchMessages(dto);
    return data;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get chat by ID',
    description: 'Get a specific chat by its ID',
  })
  @ApiParam({ name: 'id', description: 'Chat ID', type: Number })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Chat not found' })
  async getChatById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.chatService.findChatById(id);
    return data;
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create message',
    description: 'Send a new message in a chat',
  })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({ status: 201, description: 'Message created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files'))
  async createMessage(
    @Body() dto: CreateMessageDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.chatService.createMessage(dto, files);
  }

  @Get('users/search')
  @ApiOperation({
    summary: 'Search users to start chat',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  async searchUsers(@Query() dto: SearchUserForChatDto) {
    const data = await this.chatService.searchUsersForChat(dto);
    return data;
  }
}
