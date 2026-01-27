// section.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SectionService } from './section.service';
import {
  SearchSectionMasterDto,
  SearchSectionDto,
  SearchScheduleDto,
  SearchSectionEducatorDto,
  SearchEnrollmentDto,
  CreateSectionDto,
  CreateScheduleDto,
  CreateSectionScheduleDto,
  CreateSectionEducatorDto,
  CreateEnrollmentDto,
  UpdateSectionDto,
  UpdateSectionScheduleDto,
  UpdateSectionEducatorDto,
  UpdateEnrollmentDto,
  DeleteSectionEducatorDto,
  DeleteEnrollmentDto
} from './dto/section.dto';

@ApiTags('Section')
@Controller('section')
export class SectionController {
  constructor(private readonly sectionService: SectionService) {}

  // ========== Search Endpoints ==========

  /**
   * Search sections (master view with student count)
   */
  @Get('master')
  @ApiOperation({ summary: 'Search sections (master view with student count)' })
  @ApiResponse({ status: 200, description: 'Sections retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  searchMaster(@Query() dto: SearchSectionMasterDto) {
    return this.sectionService.searchMaster(dto);
  }

  /**
   * Search sections with schedule and room details
   */
  @Get()
  @ApiOperation({ summary: 'Search sections with schedule and room details' })
  @ApiResponse({ status: 200, description: 'Sections retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  search(@Query() dto: SearchSectionDto) {
    return this.sectionService.search(dto);
  }

  /**
   * Search schedules
   */
  @Get('schedule')
  @ApiOperation({ summary: 'Search schedules with room and building info' })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  searchSchedule(@Query() dto: SearchScheduleDto) {
    return this.sectionService.searchSchedule(dto);
  }

  /**
   * Search section educators
   */
  @Get('educator')
  @ApiOperation({ summary: 'Search section educators with profile info' })
  @ApiResponse({ status: 200, description: 'Section educators retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  searchEducator(@Query() dto: SearchSectionEducatorDto) {
    return this.sectionService.searchEducator(dto);
  }

  /**
   * Search enrollments
   */
  @Get('enrollment')
  @ApiOperation({ summary: 'Search enrollments with student info' })
  @ApiResponse({ status: 200, description: 'Enrollments retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  searchEnrollment(@Query() dto: SearchEnrollmentDto) {
    return this.sectionService.searchEnrollment(dto);
  }

  // ========== Create Endpoints ==========

  /**
   * Create a new section
   */
  @Post()
  @ApiOperation({ summary: 'Create a new section' })
  @ApiResponse({ status: 201, description: 'Section created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  createSection(@Body() dto: CreateSectionDto) {
    return this.sectionService.createSection(dto);
  }

  /**
   * Create a new schedule
   */
  @Post('schedule')
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields or invalid time format' })
  createSchedule(@Body() dto: CreateScheduleDto) {
    return this.sectionService.createSchedule(dto);
  }

  /**
   * Create section with schedule together
   */
  @Post('section-schedule')
  @ApiOperation({ summary: 'Create section with schedule together (transaction)' })
  @ApiResponse({ status: 201, description: 'Section and schedule created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  createSectionSchedule(@Body() dto: CreateSectionScheduleDto) {
    return this.sectionService.createSectionSchedule(dto);
  }

  /**
   * Create section educator
   */
  @Post('educator')
  @ApiOperation({ summary: 'Create section educator' })
  @ApiResponse({ status: 201, description: 'Section educator created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Educator already added to section' })
  createEducator(@Body() dto: CreateSectionEducatorDto) {
    return this.sectionService.createEducator(dto);
  }

  /**
   * Create enrollment
   */
  @Post('enrollment')
  @ApiOperation({ summary: 'Create enrollment (enroll student to section)' })
  @ApiResponse({ status: 201, description: 'Enrollment created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Student already enrolled in section' })
  createEnrollment(@Body() dto: CreateEnrollmentDto) {
    return this.sectionService.createEnrollment(dto);
  }

  // ========== Update Endpoints ==========

  /**
   * Update section
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update section by ID' })
  @ApiResponse({ status: 200, description: 'Section updated successfully' })
  @ApiResponse({ status: 404, description: 'Section not found' })
  updateSection(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto) {
    return this.sectionService.updateSection(id, dto);
  }

  /**
   * Update section with schedule together
   */
  @Put('section-schedule/update')
  @ApiOperation({ summary: 'Update section with schedule together' })
  @ApiResponse({ status: 200, description: 'Section and schedule updated successfully' })
  @ApiResponse({ status: 400, description: 'Missing section_id' })
  updateSectionSchedule(@Body() dto: UpdateSectionScheduleDto) {
    return this.sectionService.updateSectionSchedule(dto);
  }

  /**
   * Update section educator
   */
  @Put('educator/update')
  @ApiOperation({ summary: 'Update section educator' })
  @ApiResponse({ status: 200, description: 'Section educator updated successfully' })
  @ApiResponse({ status: 404, description: 'Section educator not found' })
  @ApiResponse({ status: 409, description: 'Duplicate educator in section' })
  updateEducator(@Body() dto: UpdateSectionEducatorDto) {
    return this.sectionService.updateEducator(dto);
  }

  /**
   * Update enrollment
   */
  @Put('enrollment/update')
  @ApiOperation({ summary: 'Update enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment updated successfully' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  @ApiResponse({ status: 409, description: 'Duplicate enrollment' })
  updateEnrollment(@Body() dto: UpdateEnrollmentDto) {
    return this.sectionService.updateEnrollment(dto);
  }

  // ========== Delete Endpoints ==========

  /**
   * Delete section
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete section by ID' })
  @ApiResponse({ status: 200, description: 'Section deleted successfully' })
  @ApiResponse({ status: 404, description: 'Section not found' })
  deleteSection(@Param('id', ParseIntPipe) id: number) {
    return this.sectionService.deleteSection(id);
  }

  /**
   * Delete schedule
   */
  @Delete('schedule/:id')
  @ApiOperation({ summary: 'Delete schedule by ID' })
  @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  deleteSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.sectionService.deleteSchedule(id);
  }

  /**
   * Delete section educator
   */
  @Delete('educator')
  @ApiOperation({ summary: 'Delete section educator' })
  @ApiResponse({ status: 200, description: 'Section educator deleted successfully' })
  @ApiResponse({ status: 404, description: 'No matching records found' })
  deleteEducator(@Body() dto: DeleteSectionEducatorDto) {
    return this.sectionService.deleteEducator(dto);
  }

  /**
   * Delete enrollment
   */
  @Delete('enrollment')
  @ApiOperation({ summary: 'Delete enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment deleted successfully' })
  @ApiResponse({ status: 404, description: 'No matching records found' })
  deleteEnrollment(@Body() dto: DeleteEnrollmentDto) {
    return this.sectionService.deleteEnrollment(dto);
  }
}
