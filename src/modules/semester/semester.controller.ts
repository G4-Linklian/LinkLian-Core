// semester.controller.ts
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
import { SemesterService } from './semester.service';
import {
  SearchSemesterDto,
  CreateSemesterDto,
  UpdateSemesterDto,
  CreateSemesterSubjectDto,
  DeleteSemesterSubjectDto,
} from './dto/semester.dto';

@ApiTags('Semester')
@Controller('semester')
export class SemesterController {
  constructor(private readonly semesterService: SemesterService) {}

  // ========== Semester Endpoints ==========

  /**
   * Get active semesters (open + close) sorted by semester name
   * NOTE: This must be placed BEFORE @Get(':id') to avoid route conflict
   */
  @Get('active/list')
  @ApiOperation({ summary: 'Get active semesters sorted by semester name' })
  @ApiResponse({
    status: 200,
    description: 'Active semesters retrieved successfully',
  })
  async getActiveSemesters() {
    const data = await this.semesterService.getActiveSemesters();
    return { success: true, data };
  }

  /**
   * Search semesters with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search semesters with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Semesters retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async search(@Query() dto: SearchSemesterDto) {
    const data = await this.semesterService.search(dto);
    return data;
  }

  /**
   * Get semester by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get semester by ID' })
  @ApiResponse({ status: 200, description: 'Semester found' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.semesterService.findById(id);
    return data;
  }

  /**
   * Create a new semester
   */
  @Post()
  @ApiOperation({ summary: 'Create a new semester' })
  @ApiResponse({ status: 201, description: 'Semester created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Duplicate semester' })
  async create(@Body() dto: CreateSemesterDto) {
    const data = await this.semesterService.create(dto);
    return data;
  }

  /**
   * Update an existing semester
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update semester by ID' })
  @ApiResponse({ status: 200, description: 'Semester updated successfully' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  @ApiResponse({ status: 409, description: 'Duplicate semester' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSemesterDto,
  ) {
    const data = await this.semesterService.update(id, dto);
    return data;
  }

  /**
   * Delete a semester
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete semester by ID' })
  @ApiResponse({ status: 200, description: 'Semester deleted successfully' })
  @ApiResponse({ status: 404, description: 'Semester not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    const data = await this.semesterService.delete(id);
    return data;
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
  async createSemesterSubject(@Body() dto: CreateSemesterSubjectDto) {
    const data = await this.semesterService.createSemesterSubject(dto);
    return data;
  }

  /**
   * Delete semester_subject_normalize record
   */
  @Delete('subject')
  @ApiOperation({ summary: 'Delete semester subject normalize record' })
  @ApiResponse({ status: 200, description: 'Record deleted successfully' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async deleteSemesterSubject(@Body() dto: DeleteSemesterSubjectDto) {
    const data = await this.semesterService.deleteSemesterSubject(dto);
    return data;
  }
}
