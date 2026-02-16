// subject.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubjectService } from './subject.service';
import { SearchSubjectDto, CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@ApiTags('Subject')
@Controller('subject')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  /**
   * Get subject by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get subject by ID' })
  @ApiResponse({ status: 200, description: 'Subject found' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.subjectService.findById(id);
    return { success: true, data };
  }

  /**
   * Search subjects with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search subjects with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Subjects retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async search(@Query() dto: SearchSubjectDto) {
    const data = await this.subjectService.search(dto);
    return { success: true, data };
  }

  /**
   * Create a new subject
   */
  @Post()
  @ApiOperation({ summary: 'Create a new subject' })
  @ApiResponse({ status: 201, description: 'Subject created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Duplicate subject' })
  async create(@Body() dto: CreateSubjectDto) {
    const data = await this.subjectService.create(dto);
    return { success: true, message: 'Subject created successfully', data };
  }

  /**
   * Update an existing subject
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update subject by ID' })
  @ApiResponse({ status: 200, description: 'Subject updated successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  @ApiResponse({ status: 409, description: 'Duplicate subject' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubjectDto) {
    const data = await this.subjectService.update(id, dto);
    return { success: true, message: 'Subject updated successfully', data };
  }

  /**
   * Delete a subject
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete subject by ID' })
  @ApiResponse({ status: 200, description: 'Subject deleted successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.subjectService.delete(id);
    return { success: true, message: 'Subject deleted successfully' };
  }
}
