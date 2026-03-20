import { Controller, Get, Post, Delete, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookmarkService } from './bookmark.service';

@ApiTags('Bookmark')
@Controller('bookmarks')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  /**
   * Get all bookmarks for a user (with optional filters)
   * GET /bookmarks?user_sys_id=8&offset=0&limit=50
   */
  @Get()
  @ApiOperation({ summary: 'Get bookmarks with filters' })
  @ApiResponse({ status: 200, description: 'Bookmarks retrieved successfully' })
  async getBookmarks(
    @Query('user_sys_id') user_sys_id?: string,
    @Query('post_id') post_id?: string,
    @Query('section_id') section_id?: string,
    @Query('flag_valid') flag_valid?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('sort_by') sort_by?: string,
    @Query('sort_order') sort_order?: 'ASC' | 'DESC',
  ) {
    const userId = user_sys_id ? parseInt(user_sys_id, 10) : undefined;
    const postId = post_id ? parseInt(post_id, 10) : undefined;
    const sectionId = section_id ? parseInt(section_id, 10) : undefined;
    const isFlagValid = flag_valid === 'false' ? false : true;
    const offsetVal = offset ? parseInt(offset, 10) : 0;
    const limitVal = limit ? parseInt(limit, 10) : 50;
    const sortByVal = sort_by || 'saved_at';
    const sortOrderVal = sort_order || 'DESC';

    return this.bookmarkService.getBookmarks(
      userId,
      postId,
      sectionId,
      isFlagValid,
      offsetVal,
      limitVal,
      sortByVal,
      sortOrderVal,
    );
  }

  /**
   * Toggle bookmark (create if not exists, delete if exists)
   * POST /bookmarks/toggle
   */
  @Post('toggle')
  @ApiOperation({ summary: 'Toggle bookmark (create or remove)' })
  @ApiResponse({ status: 200, description: 'Bookmark toggled successfully' })
  async toggleBookmark(@Body() dto: { user_sys_id: number; post_id: number }) {
    return this.bookmarkService.toggleBookmark(dto.user_sys_id, dto.post_id);
  }

  /**
   * Delete a bookmark by user and post
   * DELETE /bookmarks
   */
  @Delete()
  @ApiOperation({ summary: 'Delete a bookmark' })
  @ApiResponse({ status: 200, description: 'Bookmark deleted successfully' })
  async deleteBookmark(@Body() dto: { user_sys_id: number; post_id: number }) {
    return this.bookmarkService.deleteBookmark(dto.user_sys_id, dto.post_id);
  }
}
