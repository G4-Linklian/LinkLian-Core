import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class QaChatDto {
  @ApiProperty({ description: 'AI chat ID' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  ai_chat_id!: number;

  @ApiProperty({ description: 'Question to ask AI' })
  @IsNotEmpty()
  @IsString()
  question!: string;

  @ApiProperty({ description: 'Post content ID for AI context' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  post_content_id!: number;
}
