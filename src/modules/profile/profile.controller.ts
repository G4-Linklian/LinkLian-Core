// profile.controller.ts
import { Controller, Get, Put, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/profile.dto';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * Get user profile with education info
   */
  @Get(':userId')
  @ApiOperation({ summary: 'Get user profile with education info' })
  @ApiParam({ name: 'userId', description: 'User Sys ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getUserProfile(@Param('userId', ParseIntPipe) userId: number) {
    return this.profileService.getUserProfile(userId);
  }

  /**
   * Update user profile
   */
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
}
