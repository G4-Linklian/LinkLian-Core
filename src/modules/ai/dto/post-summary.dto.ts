import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PostSummaryDto {
  @ApiProperty({ description: 'Post ID to summarize' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  post_content_id!: number;
}

export class QuizGenerationDto {
  @ApiProperty({ description: 'Post ID to generate quiz for' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  post_content_id!: number;

  @ApiProperty({ description: 'Number of questions for the quiz' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  num_questions!: number;

  @ApiProperty({ description: 'Difficulty level for the quiz' })
  @IsNotEmpty()
  @IsString()
  difficulty!: string;
}
