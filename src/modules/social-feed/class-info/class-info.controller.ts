// filepath: /Users/thunyatorn/Desktop/LinkLian-Core/src/modules/social-feed/class-info/class-info.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ClassInfoService } from './class-info.service';

@ApiTags('Social Feed - Class Info')
@Controller('social-feed')
export class ClassInfoController {
  constructor(private readonly classInfoService: ClassInfoService) {}

  /**
   * Get section educators
   */
  @Get('section-educators/:sectionId')
  @ApiOperation({ summary: 'Get educators for a section' })
  @ApiResponse({ status: 200, description: 'Educators retrieved successfully' })
  getSectionEducators(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.classInfoService.getSectionEducators(sectionId);
  }

  /**
   * Get class info (schedules, members, educators, room location)
   */
  @Get('class-info/:sectionId')
  @ApiOperation({ summary: 'Get class info including schedules, members, and educators' })
  @ApiResponse({ status: 200, description: 'Class info retrieved successfully' })
  getClassInfo(@Param('sectionId', ParseIntPipe) sectionId: number) {
    return this.classInfoService.getClassInfo(sectionId);
  }
}
