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
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.programService.findById(id);
  }

  /**
   * Search programs with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search programs with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Programs retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  search(@Query() dto: SearchProgramDto) {
    return this.programService.search(dto);
  }

  /**
   * Create a new program
   */
  @Post()
  @ApiOperation({ summary: 'Create a new program' })
  @ApiResponse({ status: 201, description: 'Program created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Duplicate program' })
  create(@Body() dto: CreateProgramDto) {
    return this.programService.create(dto);
  }

  /**
   * Update an existing program
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update program by ID' })
  @ApiResponse({ status: 200, description: 'Program updated successfully' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @ApiResponse({ status: 409, description: 'Duplicate program' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProgramDto) {
    return this.programService.update(id, dto);
  }

  /**
   * Delete a program
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete program by ID' })
  @ApiResponse({ status: 200, description: 'Program deleted successfully' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.programService.delete(id);
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
  createUserSysNormalize(@Body() dto: CreateProgramUserSysDto) {
    return this.programService.createUserSysNormalize(dto);
  }

  /**
   * Update user_sys_program_normalize record
   */
  @Put('user-sys')
  @ApiOperation({ summary: 'Update user sys program normalize record' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  updateUserSysNormalize(@Body() dto: UpdateProgramUserSysDto) {
    return this.programService.updateUserSysNormalize(dto);
  }

  /**
   * Delete user_sys_program_normalize record
   */
  @Delete('user-sys')
  @ApiOperation({ summary: 'Delete user sys program normalize record' })
  @ApiResponse({ status: 200, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  deleteUserSysNormalize(@Body() dto: DeleteProgramUserSysDto) {
    return this.programService.deleteUserSysNormalize(dto);
  }
}
