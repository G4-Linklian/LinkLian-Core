import {
  Controller,
  Post,
  Get,
  Headers,
  Body,
  ParseIntPipe,
  BadRequestException,
  Param,
} from '@nestjs/common';

import { ApiTags, ApiHeader } from '@nestjs/swagger';
import { CommunityBookmarkService } from './community-bookmark.service';
import { ToggleCommunityBookmarkDto } from './dto/bookmark-community.dto';

@ApiTags('Community Bookmark')
@Controller('community/bookmark')
export class CommunityBookmarkController {

  constructor(
    private readonly service: CommunityBookmarkService,
  ) { }


  @Post('toggle')
  @ApiHeader({ name: 'x-user-id', required: true })
  async toggle(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: ToggleCommunityBookmarkDto,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.toggleBookmark(
      userId,
      dto.post_commu_id,
    );
  }

  // GET MY BOOKMARKS
  @Get()
  @ApiHeader({ name: 'x-user-id', required: true })
  async myBookmarks(
    @Headers('x-user-id') userIdHeader: string,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.getMyBookmarks(userId);
  }
  @Get('check/:postId')
  checkBookmark(
    @Headers('x-user-id') userId: string,
    @Param('postId') postId: string,
  ) {
    return this.service.checkBookmark(
      Number(userId),
      Number(postId),
    );
  }

}
