// post-comment.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Headers,
} from '@nestjs/common';
import { PostCommentService } from './post-comment.service';
import {
  GetPostCommentsDto,
  CreatePostCommentDto,
  UpdatePostCommentDto,
  DeletePostCommentDto,
} from './dto/post-comment.dto';

@Controller('post-comment')
export class PostCommentController {
  constructor(private readonly postCommentService: PostCommentService) {}

  /**
   * GET /post-comment
   * Get all comments for a post as nested tree structure
   * Query params: post_id (required), limit, offset
   */
  @Get()
  async getPostComments(@Query() dto: GetPostCommentsDto) {
    const result = await this.postCommentService.getPostComments(dto);
    return {
      success: true,
      data: result.data,
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  /**
   * POST /post-comment
   * Create a new comment on a post
   * Body: post_id, comment_text, is_anonymous?, parent_id?
   * Header: x-user-id (temporary until auth is implemented)
   */
  @Post()
  async createPostComment(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: CreatePostCommentDto,
  ) {
    const userId = parseInt(userIdHeader, 10);
    if (!userId || isNaN(userId)) {
      throw new Error('x-user-id header is required');
    }
    return this.postCommentService.createPostComment(userId, dto);
  }

  /**
   * PUT /post-comment
   * Update an existing comment (only owner can update)
   * Body: comment_id, comment_text?, flag_valid?
   */
  @Put()
  async updatePostComment(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: UpdatePostCommentDto,
  ) {
    const userId = parseInt(userIdHeader, 10);
    if (!userId || isNaN(userId)) {
      throw new Error('x-user-id header is required');
    }
    return this.postCommentService.updatePostComment(userId, dto);
  }

  /**
   * DELETE /post-comment
   * Soft delete a comment and all its replies
   * Body: comment_id
   */
  @Delete()
  async deletePostComment(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: DeletePostCommentDto,
  ) {
    const userId = parseInt(userIdHeader, 10);
    if (!userId || isNaN(userId)) {
      throw new Error('x-user-id header is required');
    }
    return this.postCommentService.deletePostComment(userId, dto);
  }
}
