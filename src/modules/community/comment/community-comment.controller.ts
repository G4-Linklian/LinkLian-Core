import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Headers,
  Req,
  Param,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { CommunityCommentService } from './community-comment.service';
import {
  GetCommunityCommentsDto,
  CreateCommunityCommentDto,
  UpdateCommunityCommentDto,
  DeleteCommunityCommentDto,
} from './dto/community-comment.dto';
import { ApiHeader, ApiQuery } from '@nestjs/swagger';

@Controller('community-comment')
export class CommunityCommentController {
  constructor(private readonly service: CommunityCommentService) { }

  @Get()
  @ApiQuery({ name: 'post_commu_id', type: Number, required: true })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  async get(@Query() dto: GetCommunityCommentsDto) {
    return this.service.getComments(dto);
  }


  @Post()
  async create(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: CreateCommunityCommentDto,
  ) {
    const userId = parseInt(userIdHeader, 10);
    return this.service.createComment(userId, dto);
  }

  @Put()
  async update(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: UpdateCommunityCommentDto,
  ) {
    const userId = parseInt(userIdHeader, 10);
    return this.service.updateComment(userId, dto);
  }


  @Delete(':commentId/hard')
  @ApiHeader({ name: 'x-user-id', required: true })
  async hardDeleteComment(
    @Headers('x-user-id') userIdHeader: string,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.hardDeleteComment(
      userId,
      commentId,
    );
  }

  @Delete()
  @ApiHeader({ name: 'x-user-id', required: true })
  async delete(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: DeleteCommunityCommentDto,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.deleteComment(userId, dto.comment_id);
  }

}

