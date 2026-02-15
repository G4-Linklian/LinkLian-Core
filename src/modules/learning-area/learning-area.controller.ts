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
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.learningAreaService.findById(id);
    return { success: true, data };
  }

  /**
   * Search learning areas with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search learning areas with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Learning areas retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async search(@Query() dto: SearchLearningAreaDto) {
    const data = await this.learningAreaService.search(dto);
    return { success: true, data };
  }

  /**
   * Create a new learning area
   */
  @Post()
  @ApiOperation({ summary: 'Create a new learning area' })
  @ApiResponse({ status: 201, description: 'Learning area created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Learning area already exists' })
  async create(@Body() dto: CreateLearningAreaDto) {
    const data = await this.learningAreaService.create(dto);
    return { success: true, message: 'Learning area created successfully!', data };
  }

  /**
   * Update an existing learning area
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update learning area by ID' })
  @ApiResponse({ status: 200, description: 'Learning area updated successfully' })
  @ApiResponse({ status: 404, description: 'Learning area not found' })
  @ApiResponse({ status: 409, description: 'Learning area already exists' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLearningAreaDto) {
    const data = await this.learningAreaService.update(id, dto);
    return { success: true, message: 'Learning area updated successfully!', data };
  }

  /**
   * Delete a learning area
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete learning area by ID' })
  @ApiResponse({ status: 200, description: 'Learning area deleted successfully' })
  @ApiResponse({ status: 404, description: 'Learning area not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    const data = await this.learningAreaService.delete(id);
    return { success: true, message: 'Learning area deleted successfully!', data };
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
  async createUserSysNormalize(@Body() dto: CreateLearningAreaUserSysDto) {
    const data = await this.learningAreaService.createUserSysNormalize(dto);
    return { success: true, message: 'Record created successfully!', data };
  }

  /**
   * Update user_sys_learning_area_normalize record
   */
  @Put('user-sys')
  @ApiOperation({ summary: 'Update user sys learning area normalize record' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async updateUserSysNormalize(@Body() dto: UpdateLearningAreaUserSysDto) {
    const data = await this.learningAreaService.updateUserSysNormalize(dto);
    return { success: true, message: 'Record updated successfully!', data };
  }

  /**
   * Delete user_sys_learning_area_normalize record
   */
  @Delete('user-sys')
  @ApiOperation({ summary: 'Delete user sys learning area normalize record' })
  @ApiResponse({ status: 200, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async deleteUserSysNormalize(@Body() dto: DeleteLearningAreaUserSysDto) {
    const data = await this.learningAreaService.deleteUserSysNormalize(dto);
    return { success: true, message: 'Record deleted successfully!', data };
  }
}
