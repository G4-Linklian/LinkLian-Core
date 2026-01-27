// dto/chat.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsObject, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

// ========== Chat DTOs ==========

export class SearchChatDto {
  @ApiPropertyOptional({ description: 'Chat ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chat_id?: number;

  @ApiPropertyOptional({ description: 'User System ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_sys_id?: number;

  @ApiPropertyOptional({ description: 'Is AI Chat', example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_ai_chat?: boolean;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'created_at' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ description: 'Sort order', example: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Limit', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}

export class CreateChatDto {
  @ApiPropertyOptional({ description: 'Is AI Chat', example: false, default: false })
  @IsOptional() @IsBoolean() is_ai_chat?: boolean;

  @ApiProperty({ description: 'Sender User ID', example: 1 })
  @IsInt() sender_id: number;

  @ApiProperty({ description: 'Receiver User ID', example: 2 })
  @IsInt() receiver_id: number;
}

// ========== Message DTOs ==========

export class SearchMessageDto {
  @ApiPropertyOptional({ description: 'Message ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  message_id?: number;

  @ApiPropertyOptional({ description: 'Chat ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chat_id?: number;

  @ApiPropertyOptional({ description: 'Sender ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sender_id?: number;

  @ApiPropertyOptional({ description: 'Content search keyword', example: 'hello' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Reply to message ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reply_id?: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'created_at' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ description: 'Sort order', example: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Limit', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}

export class CreateMessageDto {
  @ApiProperty({ description: 'Chat ID', example: 1 })
  @IsInt() chat_id: number;

  @ApiProperty({ description: 'Sender ID', example: 1 })
  @IsInt() sender_id: number;

  @ApiProperty({ description: 'Message content', example: 'Hello, how are you?' })
  @IsString() content: string;

  @ApiPropertyOptional({ description: 'Reply to message ID', example: null })
  @IsOptional() @IsInt() reply_id?: number;

  @ApiPropertyOptional({ description: 'File attachments', example: [{ url: 'https://example.com/file.pdf', name: 'file.pdf' }] })
  @IsOptional() @IsArray() file?: object[];
}

// ========== RabbitMQ Event Interface ==========

export interface ChatSendEvent {
  type: string;
  payload: {
    chat_id: number;
    sender_id: number;
    content: string;
    reply_id: number | null;
    file_url: object[] | null;
    created_at: Date;
  };
}
