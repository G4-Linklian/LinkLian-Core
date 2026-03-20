// profile.controller.ts
import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/profile.dto';
import { Access } from 'src/common/decorators/access.decorator';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * Get user profile with education info
   */
  @Access('profile', 'read')
  @Get(':userId')
  @ApiOperation({ summary: 'Get user profile with education info' })
  @ApiParam({ name: 'userId', description: 'User Sys ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getUserProfile(@Param('userId', ParseIntPipe) userId: number) {
    return this.profileService.getUserProfile(userId);
  }

  /**
   * Update user profile
   */
  @Access('profile', 'update')
  @Put(':userId')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'userId', description: 'User Sys ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or phone format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  updateProfile(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }

  /**
   * Get teaching schedule for educator
   */
  @Access('profile', 'read')
  @Get(':userId/teaching-schedule')
  @ApiOperation({ summary: 'Get teaching schedule for educator' })
  @ApiParam({ name: 'userId', description: 'User Sys ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Teaching schedule retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getTeachingSchedule(@Param('userId', ParseIntPipe) userId: number) {
    return this.profileService.getTeachingSchedule(userId);
  }
}
