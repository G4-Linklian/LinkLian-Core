// building.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BuildingService } from './building.service';
import { SearchBuildingDto, CreateBuildingDto, UpdateBuildingDto } from './dto/building.dto';

@ApiTags('Building')
@Controller('building')
export class BuildingController {
  constructor(private readonly buildingService: BuildingService) {}

  /**
   * Get building by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get building by ID' })
  @ApiResponse({ status: 200, description: 'Building found' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.buildingService.findById(id);
  }

  /**
   * Search buildings with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search buildings with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Buildings retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  search(@Query() dto: SearchBuildingDto) {
    return this.buildingService.search(dto);
  }

  /**
   * Create a new building
   */
  @Post()
  @ApiOperation({ summary: 'Create a new building' })
  @ApiResponse({ status: 201, description: 'Building created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  create(@Body() dto: CreateBuildingDto) {
    return this.buildingService.create(dto);
  }

  /**
   * Update an existing building
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update building by ID' })
  @ApiResponse({ status: 200, description: 'Building updated successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBuildingDto) {
    return this.buildingService.update(id, dto);
  }

  /**
   * Delete a building
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete building by ID' })
  @ApiResponse({ status: 200, description: 'Building deleted successfully' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.buildingService.delete(id);
  }
}
