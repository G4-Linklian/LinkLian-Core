// post-comment.dto.ts
import {
  IsNumber,
  IsString,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for getting comments of a post (query params)
 */
export class GetPostCommentsDto {
  @IsNotEmpty()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  post_id!: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  offset?: number;
}

/**
 * DTO for creating a new comment
 */
export class CreatePostCommentDto {
  @IsNumber()
  post_id!: number;

  @IsString()
  comment_text!: string;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @IsOptional()
  @IsNumber()
  parent_id?: number;
}

/**
 * DTO for updating a comment
 */
export class UpdatePostCommentDto {
  @IsNumber()
  comment_id!: number;

  @IsOptional()
  @IsString()
  comment_text?: string;

  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for deleting a comment
 */
export class DeletePostCommentDto {
  @IsNumber()
  comment_id!: number;
}

/**
 * Comment node structure for tree response
 */
export interface CommentNode {
  comment_id: number;
  post_id: number;
  user_sys_id: number;
  is_anonymous: boolean;
  comment_text: string;
  created_at: Date;
  updated_at: Date;
  flag_valid: boolean;
  parent_id: number | null;
  children_count: number;
  display_name: string | null;
  profile_pic: string | null;
  children: CommentNode[];
}

/**
 * Response structure for comment tree
 */
export interface PostCommentTreeResponse {
  success: boolean;
  data: CommentNode[];
}
