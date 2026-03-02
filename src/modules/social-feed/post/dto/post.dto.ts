// post.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PostType } from '../entities/post-content.entity';

/**
 * DTO for getting posts in a class with optional filter
 */
export class GetPostsInClassDto {
  @ApiProperty({ description: 'Section ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  section_id!: number;

  @ApiPropertyOptional({ description: 'Filter by post type', enum: PostType })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Offset for pagination', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Limit for pagination', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;
}

/**
 * DTO for attachment in create post
 */
export class AttachmentDto {
  @ApiProperty({
    description: 'File URL',
    example: 'https://storage.example.com/file.pdf',
  })
  @IsString()
  file_url!: string;

  @ApiProperty({
    description: 'File type (e.g., pdf, image, video)',
    example: 'pdf',
  })
  @IsString()
  file_type!: string;

  @ApiPropertyOptional({
    description: 'Original file name',
    example: 'my-document.pdf',
  })
  @IsOptional()
  @IsString()
  original_name?: string;
}

/**
 * DTO for creating a new post in class
 */
export class CreatePostDto {
  @ApiPropertyOptional({
    description: 'Single Section ID (deprecated, use section_ids)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({
    description: 'Multiple Section IDs',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  section_ids?: number[];

  @ApiPropertyOptional({
    description: 'Post title',
    example: 'Week 1 Assignment',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Post content',
    example: 'Please complete the following exercises...',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Post type',
    enum: PostType,
    example: 'announcement',
  })
  @IsOptional()
  @IsEnum(PostType)
  post_type?: PostType;

  @ApiPropertyOptional({ description: 'Is anonymous post', default: false })
  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @ApiPropertyOptional({ description: 'Attachments', type: [AttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  // Assignment-specific fields
  @ApiPropertyOptional({
    description: 'Due date for the assignment',
    example: '2023-10-10T10:00:00Z',
  })
  @IsOptional()
  @IsString()
  due_date?: string; // ISO date string

  @ApiPropertyOptional({
    description: 'Maximum score for the assignment',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  max_score?: number;

  @ApiPropertyOptional({
    description: 'Is this a group assignment?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_group?: boolean;

  @ApiPropertyOptional({
    description: 'Groups for the assignment',
    type: 'array',
  })
  groups?: { group_name: string; member_ids: number[] }[]; // For pre-defined groups (optional)
}

/**
 * DTO for updating a post
 */
export class UpdatePostDto {
  @ApiPropertyOptional({
    description: 'Post title',
    example: 'Updated Assignment',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Post content',
    example: 'Updated content...',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Attachments to add/replace',
    type: [AttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];

  // Assignment-specific fields
  @ApiPropertyOptional({
    description: 'Due date for the assignment',
    example: '2023-10-10T10:00:00Z',
  })
  @IsOptional()
  @IsString()
  due_date?: string;

  @ApiPropertyOptional({
    description: 'Maximum score for the assignment',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  max_score?: number;

  @ApiPropertyOptional({
    description: 'Is this a group assignment?',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_group?: boolean;
}

/**
 * DTO for searching posts by keyword
 */
export class SearchPostDto {
  @ApiPropertyOptional({
    description: 'Section ID to filter posts',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  section_id?: number;

  @ApiProperty({ description: 'Keyword to search', example: 'homework' })
  @IsString()
  keyword!: string;

  @ApiPropertyOptional({ description: 'Limit', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number = 0;
}

/**
 * Response interface for post with user info
 */
export interface PostWithUserResponse {
  post_id: number;
  post_content_id: number;
  title: string | null;
  content: string | null;
  post_type: string | null;
  is_anonymous: boolean;
  created_at: Date;
  user: {
    user_sys_id: number;
    email: string;
    profile_pic: string | null;
    display_name: string;
    role_name: string;
  } | null;
  attachments: Array<{
    file_url: string;
    file_type: string;
    original_name?: string;
  }>;
}
