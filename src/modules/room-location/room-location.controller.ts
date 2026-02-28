// room-location.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoomLocationService } from './room-location.service';
import {
  SearchRoomLocationDto,
  CreateRoomLocationDto,
  CreateRoomLocationBatchDto,
  UpdateRoomLocationDto,
} from './dto/room-location.dto';

@ApiTags('RoomLocation')
@Controller('room-location')
export class RoomLocationController {
  constructor(private readonly roomLocationService: RoomLocationService) {}

  /**
   * Get room location by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get room location by ID' })
  @ApiResponse({ status: 200, description: 'Room location found' })
  @ApiResponse({ status: 404, description: 'Room location not found' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.roomLocationService.findById(id);
    return { success: true, data };
  }

  /**
   * Search room locations with filters
   */
  @Get()
  @ApiOperation({
    summary: 'Search room locations with filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Room locations retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async search(@Query() dto: SearchRoomLocationDto) {
    const data = await this.roomLocationService.search(dto);
    return { success: true, data };
  }

  /**
   * Create a new room location
   */
  @Post()
  @ApiOperation({ summary: 'Create a new room location' })
  @ApiResponse({
    status: 201,
    description: 'Room location created successfully',
  })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Duplicate room number' })
  async create(@Body() dto: CreateRoomLocationDto) {
    const data = await this.roomLocationService.create(dto);
    return {
      success: true,
      message: 'Room location created successfully!',
      data,
    };
  }

  /**
   * Create multiple room locations in batch
   */
  @Post('batch')
  @ApiOperation({
    summary: 'Create multiple room locations in batch (with transaction)',
  })
  @ApiResponse({
    status: 201,
    description: 'Room locations created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or missing required fields',
  })
  @ApiResponse({ status: 409, description: 'Duplicate room number' })
  async createBatch(@Body() dto: CreateRoomLocationBatchDto) {
    const data = await this.roomLocationService.createBatch(dto);
    return data;
  }

  /**
   * Update an existing room location
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update room location by ID' })
  @ApiResponse({
    status: 200,
    description: 'Room location updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Room location not found' })
  @ApiResponse({ status: 409, description: 'Duplicate room number' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomLocationDto,
  ) {
    const data = await this.roomLocationService.update(id, dto);
    return {
      success: true,
      message: 'Room location updated successfully!',
      data,
    };
  }

  /**
   * Delete a room location
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete room location by ID' })
  @ApiResponse({
    status: 200,
    description: 'Room location deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Room location not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.roomLocationService.delete(id);
    return { success: true, message: 'Room location deleted successfully!' };
  }
}
