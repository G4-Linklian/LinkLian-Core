// learning-area.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LearningAreaService } from './learning-area.service';
import {
  SearchLearningAreaDto,
  CreateLearningAreaDto,
  UpdateLearningAreaDto,
  CreateLearningAreaUserSysDto,
  UpdateLearningAreaUserSysDto,
  DeleteLearningAreaUserSysDto
} from './dto/learning-area.dto';

@ApiTags('LearningArea')
@Controller('learning-area')
export class LearningAreaController {
  constructor(private readonly learningAreaService: LearningAreaService) {}

  // ========== Learning Area Endpoints ==========

  /**
   * Get learning area by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get learning area by ID' })
  @ApiResponse({ status: 200, description: 'Learning area found' })
  @ApiResponse({ status: 404, description: 'Learning area not found' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.learningAreaService.findById(id);
  }

  /**
   * Search learning areas with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search learning areas with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Learning areas retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  search(@Query() dto: SearchLearningAreaDto) {
    return this.learningAreaService.search(dto);
  }

  /**
   * Create a new learning area
   */
  @Post()
  @ApiOperation({ summary: 'Create a new learning area' })
  @ApiResponse({ status: 201, description: 'Learning area created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Learning area already exists' })
  create(@Body() dto: CreateLearningAreaDto) {
    return this.learningAreaService.create(dto);
  }

  /**
   * Update an existing learning area
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update learning area by ID' })
  @ApiResponse({ status: 200, description: 'Learning area updated successfully' })
  @ApiResponse({ status: 404, description: 'Learning area not found' })
  @ApiResponse({ status: 409, description: 'Learning area already exists' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLearningAreaDto) {
    return this.learningAreaService.update(id, dto);
  }

  /**
   * Delete a learning area
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete learning area by ID' })
  @ApiResponse({ status: 200, description: 'Learning area deleted successfully' })
  @ApiResponse({ status: 404, description: 'Learning area not found' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.learningAreaService.delete(id);
  }

  // ========== User Sys Learning Area Normalize Endpoints ==========

  /**
   * Create user_sys_learning_area_normalize record
   */
  @Post('user-sys')
  @ApiOperation({ summary: 'Create user sys learning area normalize record' })
  @ApiResponse({ status: 201, description: 'Record created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Record already exists' })
  createUserSysNormalize(@Body() dto: CreateLearningAreaUserSysDto) {
    return this.learningAreaService.createUserSysNormalize(dto);
  }

  /**
   * Update user_sys_learning_area_normalize record
   */
  @Put('user-sys')
  @ApiOperation({ summary: 'Update user sys learning area normalize record' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  updateUserSysNormalize(@Body() dto: UpdateLearningAreaUserSysDto) {
    return this.learningAreaService.updateUserSysNormalize(dto);
  }

  /**
   * Delete user_sys_learning_area_normalize record
   */
  @Delete('user-sys')
  @ApiOperation({ summary: 'Delete user sys learning area normalize record' })
  @ApiResponse({ status: 200, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  deleteUserSysNormalize(@Body() dto: DeleteLearningAreaUserSysDto) {
    return this.learningAreaService.deleteUserSysNormalize(dto);
  }
}
