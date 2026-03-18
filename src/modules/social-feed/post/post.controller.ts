// post.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Headers,
  BadRequestException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { PostService } from './post.service';
import {
  CreatePostDto,
  UpdatePostDto,
  GetPostsInClassDto,
  SearchPostDto,
  SearchPostMasterDto,
  DownloadAttachmentDto,
} from './dto/post.dto';
import type { Response } from 'express';

const encodeRFC5987 = (value: string): string =>
  encodeURIComponent(value).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

@ApiTags('Social Feed - Post')
@Controller('social-feed/post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  /**
   * Search posts by keyword
   */
  @Get('search')
  @ApiOperation({ summary: 'Search posts by keyword' })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  searchPosts(@Query() dto: SearchPostDto) {
    return this.postService.searchPosts(dto);
  }

  /**
   * Get posts in a class/section
   */
  @Get()
  @ApiOperation({ summary: 'Get posts in a class/section' })
  @ApiQuery({ name: 'section_id', description: 'Section ID', required: true })
  @ApiQuery({
    name: 'type',
    description: 'Filter by post type',
    required: false,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Offset for pagination',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Limit for pagination',
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  getPostsInClass(@Query() dto: GetPostsInClassDto) {
    return this.postService.getPostsInClass(dto);
  }

  /**
   * Download attachment (backend proxy for browser-native download behavior)
   * Additive endpoint to keep existing mobile API flow unchanged.
   */
  @Get('attachment/download')
  @ApiOperation({ summary: 'Download social-feed attachment via backend proxy' })
  @ApiQuery({ name: 'url', description: 'Attachment URL', required: true })
  @ApiQuery({ name: 'filename', description: 'Optional download filename', required: false })
  async downloadAttachment(
    @Query() dto: DownloadAttachmentDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.postService.downloadAttachment(dto);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeRFC5987(result.fileName)}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(result.data);
  }

  /**
   * Create a new post
   */
  @Post()
  @ApiOperation({ summary: 'Create a new post in class' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'User ID from auth',
    required: true,
  })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  createPost(@Headers('x-user-id') userId: string, @Body() dto: CreatePostDto) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.postService.createPost(parsedUserId, dto);
  }

  /**
   * Update a post
   */
  @Put(':postId')
  @ApiOperation({ summary: 'Update a post (owner only)' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'User ID from auth',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 403, description: 'Not allowed to update this post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  updatePost(
    @Headers('x-user-id') userId: string,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: UpdatePostDto,
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.postService.updatePost(parsedUserId, postId, dto);
  }

  /**
   * Update a post by post_content_id (for Flutter compatibility)
   */
  @Put()
  @ApiOperation({ summary: 'Update a post by post_content_id (owner only)' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'User ID from auth',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  updatePostByContentId(
    @Headers('x-user-id') userId: string,
    @Body() body: UpdatePostDto & { post_content_id: number },
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.postService.updatePost(
      parsedUserId,
      0,
      body,
      body.post_content_id,
    );
  }

  /**
   * Delete a post (soft delete)
   */
  @Delete(':postId')
  @ApiOperation({ summary: 'Delete a post (owner only, soft delete)' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'User ID from auth',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  @ApiResponse({ status: 403, description: 'Not allowed to delete this post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  deletePost(
    @Headers('x-user-id') userId: string,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.postService.deletePost(parsedUserId, postId);
  }

  /**
   * Delete a post by body (for Flutter compatibility)
   */
  @Delete()
  @ApiOperation({ summary: 'Delete a post by post_id and post_content_id' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'User ID from auth',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  deletePostByBody(
    @Headers('x-user-id') userId: string,
    @Body() body: { post_id?: number; post_content_id?: number },
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.postService.deletePost(
      parsedUserId,
      body.post_id || 0,
      body.post_content_id,
    );
  }
  @Get('search-master')
  @ApiOperation({ summary: 'Search posts by post_content_id' })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  searchPostMaster(@Query() dto: SearchPostMasterDto) {
    return this.postService.searchPostMaster(dto);
  }

  @Get(':postId')
  getPostById(@Param('postId', ParseIntPipe) postId: number) {
    return this.postService.getPostById(postId);
  }
}
