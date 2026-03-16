import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsOptional } from 'class-validator';

export class CreateAiChatDto {
  @ApiProperty()
  @IsInt()
  post_content_id: number;
}

export class CreateQuizDto {
  @ApiProperty()
  @IsInt()
  ai_chat_id: number;

  @ApiProperty()
  @IsString()
  difficulty: string;

  @ApiProperty()
  @IsInt()
  question_count: number;
}