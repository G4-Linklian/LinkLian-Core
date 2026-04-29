import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class CreateQuizDto {

  @ApiProperty()
  @IsInt()
  ai_chat_id: number;

  @ApiProperty()
  @IsString()
  difficulty: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  mode: 'exam' | 'learning';

  @ApiProperty()
  @IsInt()
  question_count: number;

}