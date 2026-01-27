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
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.subjectService.findById(id);
  }

  /**
   * Search subjects with filters
   */
  @Get()
  @ApiOperation({ summary: 'Search subjects with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Subjects retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  search(@Query() dto: SearchSubjectDto) {
    return this.subjectService.search(dto);
  }

  /**
   * Create a new subject
   */
  @Post()
  @ApiOperation({ summary: 'Create a new subject' })
  @ApiResponse({ status: 201, description: 'Subject created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Duplicate subject' })
  create(@Body() dto: CreateSubjectDto) {
    return this.subjectService.create(dto);
  }

  /**
   * Update an existing subject
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update subject by ID' })
  @ApiResponse({ status: 200, description: 'Subject updated successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  @ApiResponse({ status: 409, description: 'Duplicate subject' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubjectDto) {
    return this.subjectService.update(id, dto);
  }

  /**
   * Delete a subject
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete subject by ID' })
  @ApiResponse({ status: 200, description: 'Subject deleted successfully' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.subjectService.delete(id);
  }
}
