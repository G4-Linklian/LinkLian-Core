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
   * Get edu_level by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get edu_level by ID' })
  @ApiResponse({ status: 200, description: 'EduLevel found' })
  @ApiResponse({ status: 404, description: 'EduLevel not found' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.eduLevelService.findById(id);
  }

  /**
   * Search edu_level master data with filters
   */
  @Get('master')
  @ApiOperation({ summary: 'Search edu_level master data with filters' })
  @ApiResponse({ status: 200, description: 'EduLevels retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  searchMaster(@Query() dto: SearchEduLevelMasterDto) {
    return this.eduLevelService.searchMaster(dto);
  }

  /**
   * Search edu_level with program joins
   */
  @Get()
  @ApiOperation({ summary: 'Search edu_level with program joins and pagination' })
  @ApiResponse({ status: 200, description: 'EduLevels retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  search(@Query() dto: SearchEduLevelDto) {
    return this.eduLevelService.search(dto);
  }

  /**
   * Create a new edu_level
   */
  @Post()
  @ApiOperation({ summary: 'Create a new edu_level' })
  @ApiResponse({ status: 201, description: 'EduLevel created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'EduLevel already exists' })
  create(@Body() dto: CreateEduLevelDto) {
    return this.eduLevelService.create(dto);
  }

  /**
   * Update an existing edu_level
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update edu_level by ID' })
  @ApiResponse({ status: 200, description: 'EduLevel updated successfully' })
  @ApiResponse({ status: 404, description: 'EduLevel not found' })
  @ApiResponse({ status: 409, description: 'EduLevel already exists' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEduLevelDto) {
    return this.eduLevelService.update(id, dto);
  }

  /**
   * Delete an edu_level
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete edu_level by ID' })
  @ApiResponse({ status: 200, description: 'EduLevel deleted successfully' })
  @ApiResponse({ status: 404, description: 'EduLevel not found' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.eduLevelService.delete(id);
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
  createNormalize(@Body() dto: CreateEduLevelNormDto) {
    return this.eduLevelService.createNormalize(dto);
  }

  /**
   * Update edu_level_program_normalize to set flag_valid = true
   */
  @Put('normalize')
  @ApiOperation({ summary: 'Update edu_level_program_normalize to set flag_valid = true' })
  @ApiResponse({ status: 200, description: 'EduLevel normalize updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  updateNormalize(@Body() dto: CreateEduLevelNormDto) {
    return this.eduLevelService.updateNormalize(dto);
  }

  /**
   * Delete edu_level_program_normalize record
   */
  @Delete('normalize')
  @ApiOperation({ summary: 'Delete edu_level_program_normalize record' })
  @ApiResponse({ status: 200, description: 'EduLevel normalize deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  deleteNormalize(@Body() dto: DeleteEduLevelNormDto) {
    return this.eduLevelService.deleteNormalize(dto);
  }
}
