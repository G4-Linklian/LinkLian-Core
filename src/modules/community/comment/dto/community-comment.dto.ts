import { Type } from 'class-transformer';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class GetCommunityCommentsDto {

  @Type(() => Number)
  @IsNumber()
  post_commu_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;
}

export class CreateCommunityCommentDto {
  @IsNumber()
  post_commu_id: number;

  @IsString()
  comment_text: string;

  @IsOptional()
  @IsNumber()
  parent_id?: number;
}

export class UpdateCommunityCommentDto {
  @IsNumber()
  comment_id: number;

  @IsOptional()
  @IsString()
  comment_text?: string;
}

export class DeleteCommunityCommentDto {
  @IsNumber()
  comment_id: number;
}
