import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  Query,
  Req,
  Delete,
  Put,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiBody,
  ApiHeader,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { FileStorageService } from '../../file-storage/file-storage.service';
import { UpdateCommunityDto } from './dto/update-community.dto';

@ApiTags('Community')
@Controller('community')
export class CommunityController {
  constructor(
    private readonly service: CommunityService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  // Create Community

  @Post()
  @ApiOperation({ summary: 'Create new community' })
  @ApiHeader({
    name: 'x-user-id',
    required: true,
    description: 'User ID from authentication system',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        rule: { type: 'string' },
        is_private: { type: 'boolean' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          example: ['math', 'biology', 'exam'],
        },
        image: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Community created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Headers('x-user-id') userIdHeader: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateCommunityDto,
    @Req() req: any,
  ) {
    console.log('RAW BODY:', req.body);
    console.log('DTO is_private:', dto.is_private, typeof dto.is_private);
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }
    console.log('DTO is_private:', dto.is_private, typeof dto.is_private);

    if (!file) {
      throw new BadRequestException('Image is required');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const uploadResult = await this.fileStorageService.uploadFiles(
      'community',
      'banner',
      [file],
    );

    const bannerUrl = uploadResult.files[0].fileUrl;

    return this.service.createCommunity(userId, {
      ...dto,
      image_banner: bannerUrl,
    });
  }

  @Get('tag/search')
  @ApiOperation({ summary: 'Search community tags' })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
  })
  async searchTag(@Query('keyword') keyword?: string) {
    return this.service.searchTag(keyword);
  }

  @Get()
  @ApiOperation({ summary: 'Get communities (owner or search)' })
  @ApiHeader({
    name: 'x-user-id',
    required: true,
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
  })
  async list(
    @Headers('x-user-id') userIdHeader: string,
    @Query('keyword') keyword?: string,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.listCommunity(userId, keyword);
  }

  @Get('detail/:id')
  @ApiOperation({ summary: 'Get community by ID' })
  @ApiHeader({
    name: 'x-user-id',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Community detail' })
  @ApiResponse({ status: 404, description: 'Community not found' })
  async get(
    @Headers('x-user-id') userIdHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.getCommunityDetail(userId, id);
  }

  @Get(':id/posts')
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiOperation({ summary: 'Get posts in community (feed style)' })
  async getCommunityPosts(
    @Headers('x-user-id') userIdHeader: string,
    @Param('id', ParseIntPipe) communityId: number,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.getCommunityFeed(userId, communityId);
  }

  @Put(':communityId')
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiBody({ type: UpdateCommunityDto })
  async updateCommunity(
    @Headers('x-user-id') userIdHeader: string,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() dto: UpdateCommunityDto,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    console.log('DTO:', dto);

    return this.service.updateCommunity(userId, communityId, dto);
  }

  // HARD DELETE COMMUNITY
  @Delete(':communityId/hard')
  @ApiHeader({ name: 'x-user-id', required: true })
  async hardDeleteCommunity(
    @Headers('x-user-id') userIdHeader: string,
    @Param('communityId', ParseIntPipe) communityId: number,
  ) {
    const userId = parseInt(userIdHeader, 10);

    if (isNaN(userId)) {
      throw new BadRequestException('Invalid x-user-id');
    }

    return this.service.hardDeleteCommunity(userId, communityId);
  }
}
