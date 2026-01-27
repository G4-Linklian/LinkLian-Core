// feed.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { GetClassFeedDto } from './dto/feed.dto';

@ApiTags('Social Feed - Class Feed')
@Controller('social-feed/feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  /**
   * Get student class feed with schedules
   */
  @Get('student')
  @ApiOperation({ summary: 'Get student class feed with schedules for a semester' })
  @ApiResponse({ status: 200, description: 'Class feed retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  getStudentClassFeed(@Query() dto: GetClassFeedDto) {
    return this.feedService.getStudentClassFeed(dto);
  }

  /**
   * Get teacher class feed with schedules
   */
  @Get('teacher')
  @ApiOperation({ summary: 'Get teacher class feed with schedules for a semester' })
  @ApiResponse({ status: 200, description: 'Class feed retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  getTeacherClassFeed(@Query() dto: GetClassFeedDto) {
    return this.feedService.getTeacherClassFeed(dto);
  }
}
