import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const toBoolean = (value: unknown): boolean => value === true || value === 'true';

export class SearchAiChatDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ai_chat_id?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  post_content_id?: number;

  @ApiPropertyOptional({ example: 'midterm' })
  @IsOptional()
  @IsString()
  chat_title?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ enum: ['ai_chat_id', 'created_at', 'post_content_id'] })
  @IsOptional()
  @IsString()
  @IsIn(['ai_chat_id', 'created_at', 'post_content_id'])
  sort_by?: 'ai_chat_id' | 'created_at' | 'post_content_id';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], example: 'DESC' })
  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sort_order?: 'ASC' | 'DESC' | 'asc' | 'desc';

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}

export class CreateAiChatDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  post_content_id!: number;

  @ApiPropertyOptional({ example: 'Chat about chapter 1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chat_title?: string;

  @ApiPropertyOptional({ example: 'Overview of uploaded documents' })
  @IsOptional()
  @IsString()
  summary_text?: string;
}

export class UpdateAiChatDto {
  @ApiPropertyOptional({ example: 'Updated title' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chat_title?: string;

  @ApiPropertyOptional({ example: 'Updated summary text' })
  @IsOptional()
  @IsString()
  summary_text?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  flag_valid?: boolean;
}

export class SearchAiMessageDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ai_message_id?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ai_chat_id?: number;

  @ApiPropertyOptional({ example: 'user' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'Explain this section' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ enum: ['ai_message_id', 'created_at'] })
  @IsOptional()
  @IsString()
  @IsIn(['ai_message_id', 'created_at'])
  sort_by?: 'ai_message_id' | 'created_at';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], example: 'ASC' })
  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sort_order?: 'ASC' | 'DESC' | 'asc' | 'desc';

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}

export class CreateAiMessageDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  ai_chat_id!: number;

  @ApiProperty({ example: 'user' })
  @IsString()
  @IsNotEmpty()
  question!: string;

  @ApiProperty({ example: 'What is the key point?' })
  @IsInt()
  @IsNotEmpty()
  post_content_id!: number;
}
