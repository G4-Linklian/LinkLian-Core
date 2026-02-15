// edu-level.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EduLevelService } from './edu-level.service';
import { 
  SearchEduLevelMasterDto, 
  SearchEduLevelDto, 
  CreateEduLevelDto, 
  UpdateEduLevelDto,
  CreateEduLevelNormDto,
  DeleteEduLevelNormDto 
} from './dto/edu-level.dto';

@ApiTags('EduLevel')
@Controller('edu-level')
export class EduLevelController {
  constructor(private readonly eduLevelService: EduLevelService) {}

  // ========== EduLevel Master Endpoints ==========

  /**
   * Search edu_level master data with filters
   */
  @Get('master')
  @ApiOperation({ summary: 'Search edu_level master data with filters' })
  @ApiResponse({ status: 200, description: 'EduLevels retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async searchMaster(@Query() dto: SearchEduLevelMasterDto) {
    const data = await this.eduLevelService.searchMaster(dto);
    return { success: true, data };
    // return this.eduLevelService.searchMaster(dto);
  }

  /**
   * Search edu_level with program joins
   */
  @Get()
  @ApiOperation({ summary: 'Search edu_level with program joins and pagination' })
  @ApiResponse({ status: 200, description: 'EduLevels retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async search(@Query() dto: SearchEduLevelDto) {
    const data = await this.eduLevelService.search(dto);
    return { success: true, data };
  }

  /**
   * Get edu_level by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get edu_level by ID' })
  @ApiResponse({ status: 200, description: 'EduLevel found' })
  @ApiResponse({ status: 404, description: 'EduLevel not found' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.eduLevelService.findById(id);
    return { success: true, data };
  }

  /**
   * Create a new edu_level
   */
  @Post()
  @ApiOperation({ summary: 'Create a new edu_level' })
  @ApiResponse({ status: 201, description: 'EduLevel created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'EduLevel already exists' })
  async create(@Body() dto: CreateEduLevelDto) {
    const data = await this.eduLevelService.create(dto);
    return { success: true, message: "EduLevel created successfully", data };
  }

  /**
   * Update an existing edu_level
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update edu_level by ID' })
  @ApiResponse({ status: 200, description: 'EduLevel updated successfully' })
  @ApiResponse({ status: 404, description: 'EduLevel not found' })
  @ApiResponse({ status: 409, description: 'EduLevel already exists' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEduLevelDto) {
    const data = await this.eduLevelService.update(id, dto);
    return { success: true, message: "EduLevel updated successfully", data };
  }

  /**
   * Delete an edu_level
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete edu_level by ID' })
  @ApiResponse({ status: 200, description: 'EduLevel deleted successfully' })
  @ApiResponse({ status: 404, description: 'EduLevel not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    const data = await this.eduLevelService.delete(id);
    return { success: true, message: "EduLevel deleted successfully", data };
  }

  // ========== EduLevel Normalize Endpoints ==========

  /**
   * Create edu_level_program_normalize record
   */
  @Post('normalize')
  @ApiOperation({ summary: 'Create edu_level_program_normalize record' })
  @ApiResponse({ status: 201, description: 'EduLevel normalize created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Record already exists' })
  async createNormalize(@Body() dto: CreateEduLevelNormDto) {
    const data = await this.eduLevelService.createNormalize(dto);
    return { success: true, message: "EduLevel normalize created successfully", data };
  }

  /**
   * Update edu_level_program_normalize to set flag_valid = true
   */
  @Put('normalize')
  @ApiOperation({ summary: 'Update edu_level_program_normalize to set flag_valid = true' })
  @ApiResponse({ status: 200, description: 'EduLevel normalize updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async updateNormalize(@Body() dto: CreateEduLevelNormDto) {
    const data = await this.eduLevelService.updateNormalize(dto);
    return { success: true, message: "EduLevel normalize updated successfully", data };
  }

  /**
   * Delete edu_level_program_normalize record
   */
  @Post('normalize/delete')
  @ApiOperation({ summary: 'Delete edu_level_program_normalize record' })
  @ApiResponse({ status: 200, description: 'EduLevel normalize deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async deleteNormalize(@Body() dto: DeleteEduLevelNormDto) {
    const data = await this.eduLevelService.deleteNormalize(dto);
    return { success: true, message: "EduLevel normalize deleted successfully", data };
  }
}
