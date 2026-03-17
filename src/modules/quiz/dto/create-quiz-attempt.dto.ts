import { IsInt, IsObject } from 'class-validator';

export class CreateQuizAttemptDto {

  @IsInt()
  quiz_id: number;

  @IsInt()
  score: number;

  @IsInt()
  total: number;

  @IsObject()
  answers: any;
}