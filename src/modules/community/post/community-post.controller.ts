import {
  Controller,
  Post,
  Get,
  Delete,
  Headers,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Req,
  ParseIntPipe,
  Put,
} from '@nestjs/common';

import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader } from '@nestjs/swagger';

import { CommunityPostService } from './community-post.service';
import { CreateCommunityPostDto } from './dto/create-community-post.dto';

@Controller('community/post')
export class CommunityPostController {

  constructor(private service: CommunityPostService) { }

  @Post()
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        community_id: { type: 'number', example: 1 },
        content: { type: 'string', example: 'https://youtube.com/abc' },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })

  @UseInterceptors(FilesInterceptor('files'))
  create(
    @Headers('x-user-id') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateCommunityPostDto,
  ) {
    return this.service.createPost(
      Number(userId),
      dto,
      files,
    );
  }


  @Get('search')
  search(
    @Headers('x-user-id') userId: string,
    @Query('community_id', ParseIntPipe) communityId: number,
    @Query('keyword') keyword: string,
    @Query('limit', ParseIntPipe) limit: number,
  ) {
    if (!keyword?.trim()) {
      throw new BadRequestException('Keyword required');
    }

    return this.service.searchPosts(
      Number(userId),
      communityId,
      keyword,
      limit || 50,
    );
  }

  @Get(':communityId')
  getPosts(
    @Headers('x-user-id') userId: string,
    @Param('communityId') communityId: number,
    @Query('limit') limit: number,
    @Query('offset') offset: number,
    @Query('sort') sort: string,
  ) {
    return this.service.getPosts(
      Number(userId),
      Number(communityId),
      Number(limit) || 20,
      Number(offset) || 0,
      sort || 'newest',
    );
  }

  // @Put(':postId')
  // @ApiHeader({ name: 'x-user-id', required: true })
  // @UseInterceptors(FilesInterceptor('files'))
  // async updatePost(
  //   @Headers('x-user-id') userIdHeader: string,
  //   @Param('postId', ParseIntPipe) postId: number,
  //   @Body() dto: any,
  //   @UploadedFiles() files: Express.Multer.File[],
  // ) {
  //   const userId = parseInt(userIdHeader, 10);

  //   if (isNaN(userId)) {
  //     throw new BadRequestException('Invalid x-user-id');
  //   }

  //   return this.service.updatePost(
  //     userId,
  //     postId,
  //     dto,
  //     files,
  //   );
  // }
  @Put(':postId')
@ApiHeader({ name: 'x-user-id', required: true })
@ApiConsumes('multipart/form-data')
@UseInterceptors(FilesInterceptor('files'))
async updatePost(
  @Headers('x-user-id') userIdHeader: string,
  @Param('postId', ParseIntPipe) postId: number,
  @Body() dto: any,
  @UploadedFiles() files: Express.Multer.File[],
) {

  const userId = parseInt(userIdHeader, 10);

  if (isNaN(userId)) {
    throw new BadRequestException('Invalid x-user-id');
  }

  if (dto.keep_attachments) {
    try {
      if (typeof dto.keep_attachments === 'string') {
        dto.keep_attachments = JSON.parse(dto.keep_attachments);
      }
    } catch (e) {
      throw new BadRequestException('Invalid keep_attachments format');
    }
  }

  return this.service.updatePost(
    userId,
    postId,
    dto,
    files,
  );
}


  // HARD DELETE POST
  @Delete(':postId/hard')
  @ApiHeader({ name: 'x-user-id', required: true })
  async hardDeletePost(
    @Headers('x-user-id') userIdHeader: string,
    @Param('postId', ParseIntPipe) postId: number,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.hardDeletePost(
      userId,
      postId,
    );
  }

  @Delete(':postId')
  @ApiHeader({ name: 'x-user-id', required: true })
  async deletePost(
    @Headers('x-user-id') userIdHeader: string,
    @Param('postId') postId: string,
  ) {
    const userId = parseInt(userIdHeader, 10);
    const postIdNum = parseInt(postId as any, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.deletePost(userId, postIdNum);
  }

}


// @Delete(':postId')
// deletePost(
//   @Headers('x-user-id') userId: string,
//   @Param('postId') postId: string,
// ) {
//   return this.service.deletePost(
//     Number(userId),
//     Number(postId),
//   );
// }

