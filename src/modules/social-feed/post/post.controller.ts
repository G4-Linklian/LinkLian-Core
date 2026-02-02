// post.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { PostService } from './post.service';
import { CreatePostDto, UpdatePostDto, GetPostsInClassDto, SearchPostDto } from './dto/post.dto';

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
  @ApiQuery({ name: 'type', description: 'Filter by post type', required: false })
  @ApiQuery({ name: 'offset', description: 'Offset for pagination', required: false })
  @ApiQuery({ name: 'limit', description: 'Limit for pagination', required: false })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  getPostsInClass(@Query() dto: GetPostsInClassDto) {
    return this.postService.getPostsInClass(dto);
  }

  /**
   * Create a new post
   */
  @Post()
  @ApiOperation({ summary: 'Create a new post in class' })
  @ApiHeader({ name: 'x-user-id', description: 'User ID from auth', required: true })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  createPost(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreatePostDto,
  ) {
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
  @ApiHeader({ name: 'x-user-id', description: 'User ID from auth', required: true })
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
  @ApiHeader({ name: 'x-user-id', description: 'User ID from auth', required: true })
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
      { title: body.title, content: body.content, attachments: body.attachments },
      body.post_content_id
    );
  }

  /**
   * Delete a post (soft delete)
   */
  @Delete(':postId')
  @ApiOperation({ summary: 'Delete a post (owner only, soft delete)' })
  @ApiHeader({ name: 'x-user-id', description: 'User ID from auth', required: true })
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
  @ApiHeader({ name: 'x-user-id', description: 'User ID from auth', required: true })
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
      body.post_content_id
    );
  }
}
