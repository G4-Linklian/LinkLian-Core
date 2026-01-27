// post.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { PostType } from '../entities/post-content.entity';

/**
 * DTO for getting posts in a class with optional filter
 */
export class GetPostsInClassDto {
  @ApiProperty({ description: 'Section ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  section_id: number;

  @ApiPropertyOptional({ description: 'Filter by post type', enum: PostType })
  @IsOptional()
  @IsString()
  type?: string;
}

/**
 * DTO for attachment in create post
 */
export class AttachmentDto {
  @ApiProperty({ description: 'File URL', example: 'https://storage.example.com/file.pdf' })
  @IsString()
  file_url: string;

  @ApiProperty({ description: 'File type (e.g., pdf, image, video)', example: 'pdf' })
  @IsString()
  file_type: string;
}

/**
 * DTO for creating a new post in class
 */
export class CreatePostDto {
  @ApiProperty({ description: 'Section ID', example: 1 })
  @IsInt()
  section_id: number;

  @ApiPropertyOptional({ description: 'Post title', example: 'Week 1 Assignment' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Post content', example: 'Please complete the following exercises...' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Post type', enum: PostType, example: 'announcement' })
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
}

/**
 * DTO for updating a post
 */
export class UpdatePostDto {
  @ApiPropertyOptional({ description: 'Post title', example: 'Updated Assignment' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Post content', example: 'Updated content...' })
  @IsOptional()
  @IsString()
  content?: string;
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
  }>;
}
