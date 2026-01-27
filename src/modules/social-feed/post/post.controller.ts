// post.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { PostService } from './post.service';
import { CreatePostDto, UpdatePostDto, GetPostsInClassDto } from './dto/post.dto';

@ApiTags('Social Feed - Post')
@Controller('social-feed/post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  /**
   * Get posts in a class/section
   */
  @Get()
  @ApiOperation({ summary: 'Get posts in a class/section with optional filter' })
  @ApiResponse({ status: 200, description: 'Posts retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  getPostsInClass(@Query() dto: GetPostsInClassDto) {
    return this.postService.getPostsInClass(dto);
  }

  /**
   * Create a new post in class
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
    return this.postService.createPost(Number(userId), dto);
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
    return this.postService.updatePost(Number(userId), postId, dto);
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
    return this.postService.deletePost(Number(userId), postId);
  }
}
