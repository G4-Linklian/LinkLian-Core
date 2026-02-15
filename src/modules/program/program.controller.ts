// program.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProgramService } from './program.service';
import {
  SearchProgramDto,
  CreateProgramDto,
  UpdateProgramDto,
  CreateProgramUserSysDto,
  UpdateProgramUserSysDto,
  DeleteProgramUserSysDto
} from './dto/program.dto';

@ApiTags('Program')
@Controller('program')
export class ProgramController {
  constructor(private readonly programService: ProgramService) {}

  // ========== Program Endpoints ==========

  /**
   * Get program by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get program by ID' })
  @ApiResponse({ status: 200, description: 'Program found' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.programService.findById(id);
    return { success: true, data };
  }

  /**
   * Search programs with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search programs with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Programs retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async search(@Query() dto: SearchProgramDto) {
    const data = await this.programService.search(dto);
    return { success: true, data };
  }

  /**
   * Create a new program
   */
  @Post()
  @ApiOperation({ summary: 'Create a new program' })
  @ApiResponse({ status: 201, description: 'Program created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Duplicate program' })
  async create(@Body() dto: CreateProgramDto) {
    const data = await this.programService.create(dto);
    return { success: true, message: "Created program successfully", data };
  }

  /**
   * Update an existing program
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update program by ID' })
  @ApiResponse({ status: 200, description: 'Program updated successfully' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @ApiResponse({ status: 409, description: 'Duplicate program' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProgramDto) {
    const data = await this.programService.update(id, dto);
    return { success: true, message: "Updated program successfully", data };
  }

  /**
   * Delete a program
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete program by ID' })
  @ApiResponse({ status: 200, description: 'Program deleted successfully' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    const data = await this.programService.delete(id);
    return { success: true, message: "Deleted program successfully", data };
  }

  // ========== User Sys Program Normalize Endpoints ==========

  /**
   * Create user_sys_program_normalize record
   */
  @Post('user-sys')
  @ApiOperation({ summary: 'Create user sys program normalize record' })
  @ApiResponse({ status: 201, description: 'Record created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Record already exists' })
  async createUserSysNormalize(@Body() dto: CreateProgramUserSysDto) {
    const data = await this.programService.createUserSysNormalize(dto);
    return { success: true, message: "Created user sys program normalize record successfully", data };
  }

  /**
   * Update user_sys_program_normalize record
   */
  @Put('user-sys')
  @ApiOperation({ summary: 'Update user sys program normalize record' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async updateUserSysNormalize(@Body() dto: UpdateProgramUserSysDto) {
    const data = await this.programService.updateUserSysNormalize(dto);
    return { success: true, message: "Updated user sys program normalize record successfully", data };
  }

  /**
   * Delete user_sys_program_normalize record
   */
  @Delete('user-sys')
  @ApiOperation({ summary: 'Delete user sys program normalize record' })
  @ApiResponse({ status: 200, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async deleteUserSysNormalize(@Body() dto: DeleteProgramUserSysDto) {
    const data = await this.programService.deleteUserSysNormalize(dto);
    return { success: true, message: "Deleted user sys program normalize record successfully", data };
  }
}
