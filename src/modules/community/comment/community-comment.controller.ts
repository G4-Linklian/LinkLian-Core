import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Headers,
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
import { ApiHeader, ApiQuery, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Access } from 'src/common/decorators/access.decorator';

@ApiTags('Community Comment')
@ApiBearerAuth('access-token')
@Controller('community-comment')
export class CommunityCommentController {
  constructor(private readonly service: CommunityCommentService) {}

  @Access('community', 'read')
  @Get()
  @ApiQuery({ name: 'post_commu_id', type: Number, required: true })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  async get(@Query() dto: GetCommunityCommentsDto) {
    return this.service.getComments(dto);
  }

  @Access('community', 'create')
  @Post()
  async create(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: CreateCommunityCommentDto,
  ) {
    const userId = parseInt(userIdHeader, 10);
    return this.service.createComment(userId, dto);
  }

  @Access('community', 'update')
  @Put()
  async update(
    @Headers('x-user-id') userIdHeader: string,
    @Body() dto: UpdateCommunityCommentDto,
  ) {
    const userId = parseInt(userIdHeader, 10);
    return this.service.updateComment(userId, dto);
  }

  @Access('community', 'delete')
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

    return this.service.hardDeleteComment(userId, commentId);
  }

  @Access('community', 'delete')
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
