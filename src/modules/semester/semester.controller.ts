// semester.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SemesterService } from './semester.service';
import {
  SearchSemesterDto,
  CreateSemesterDto,
  UpdateSemesterDto,
  CreateSemesterSubjectDto,
  DeleteSemesterSubjectDto
} from './dto/semester.dto';

@ApiTags('Semester')
@Controller('semester')
export class SemesterController {
  constructor(private readonly semesterService: SemesterService) {}

  // ========== Semester Endpoints ==========

  /**
   * Get semester by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get semester by ID' })
  @ApiResponse({ status: 200, description: 'Semester found' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.semesterService.findById(id);
  }

  /**
   * Search semesters with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search semesters with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Semesters retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  search(@Query() dto: SearchSemesterDto) {
    return this.semesterService.search(dto);
  }

  /**
   * Create a new semester
   */
  @Post()
  @ApiOperation({ summary: 'Create a new semester' })
  @ApiResponse({ status: 201, description: 'Semester created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Duplicate semester' })
  create(@Body() dto: CreateSemesterDto) {
    return this.semesterService.create(dto);
  }

  /**
   * Update an existing semester
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update semester by ID' })
  @ApiResponse({ status: 200, description: 'Semester updated successfully' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  @ApiResponse({ status: 409, description: 'Duplicate semester' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSemesterDto) {
    return this.semesterService.update(id, dto);
  }

  /**
   * Delete a semester
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete semester by ID' })
  @ApiResponse({ status: 200, description: 'Semester deleted successfully' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.semesterService.delete(id);
  }

  // ========== Semester Subject Normalize Endpoints ==========

  /**
   * Create semester_subject_normalize record
   */
  @Post('subject')
  @ApiOperation({ summary: 'Create semester subject normalize record' })
  @ApiResponse({ status: 201, description: 'Record created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Record already exists' })
  createSemesterSubject(@Body() dto: CreateSemesterSubjectDto) {
    return this.semesterService.createSemesterSubject(dto);
  }

  /**
   * Delete semester_subject_normalize record
   */
  @Delete('subject')
  @ApiOperation({ summary: 'Delete semester subject normalize record' })
  @ApiResponse({ status: 200, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  deleteSemesterSubject(@Body() dto: DeleteSemesterSubjectDto) {
    return this.semesterService.deleteSemesterSubject(dto);
  }
}
