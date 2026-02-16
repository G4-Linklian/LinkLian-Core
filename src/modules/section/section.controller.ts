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
  async searchMaster(@Query() dto: SearchSectionMasterDto) {
    const data = await this.sectionService.searchMaster(dto);
    return { success: true, data };
  }

  /**
   * Search sections with schedule and room details
   */
  @Get()
  @ApiOperation({ summary: 'Search sections with schedule and room details' })
  @ApiResponse({ status: 200, description: 'Sections retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async search(@Query() dto: SearchSectionDto) {
    const data = await this.sectionService.search(dto);
    return { success: true, data };
  }

  /**
   * Search schedules
   */
  @Get('schedule')
  @ApiOperation({ summary: 'Search schedules with room and building info' })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async searchSchedule(@Query() dto: SearchScheduleDto) {
    const data = await this.sectionService.searchSchedule(dto);
    return { success: true, data };
  }

  /**
   * Search section educators
   */
  @Get('educator')
  @ApiOperation({ summary: 'Search section educators with profile info' })
  @ApiResponse({ status: 200, description: 'Section educators retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async searchEducator(@Query() dto: SearchSectionEducatorDto) {
    const data = await this.sectionService.searchEducator(dto);
    return { success: true, data };
  }

  /**
   * Search enrollments
   */
  @Get('enrollment')
  @ApiOperation({ summary: 'Search enrollments with student info' })
  @ApiResponse({ status: 200, description: 'Enrollments retrieved successfully' })
  @ApiResponse({ status: 400, description: 'No search parameters provided' })
  async searchEnrollment(@Query() dto: SearchEnrollmentDto) {
    const data = await this.sectionService.searchEnrollment(dto);
    return { success: true, data };
  }

  // ========== Create Endpoints ==========

  /**
   * Create a new section
   */
  @Post()
  @ApiOperation({ summary: 'Create a new section' })
  @ApiResponse({ status: 201, description: 'Section created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  async createSection(@Body() dto: CreateSectionDto) {
    const data = await this.sectionService.createSection(dto);
    return { success: true, message: 'Section created successfully', data };
  }

  /**
   * Create a new schedule
   */
  @Post('schedule')
  @ApiOperation({ summary: 'Create a new schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields or invalid time format' })
  async createSchedule(@Body() dto: CreateScheduleDto) {
    const data = await this.sectionService.createSchedule(dto);
    return { success: true, message: 'Schedule created successfully', data };
  }

  /**
   * Create section with schedule together
   */
  @Post('section-schedule')
  @ApiOperation({ summary: 'Create section with schedule together (transaction)' })
  @ApiResponse({ status: 201, description: 'Section and schedule created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  async createSectionSchedule(@Body() dto: CreateSectionScheduleDto) {
    const data = await this.sectionService.createSectionSchedule(dto);
    return { success: true, message: 'Section and schedule created successfully', data };
  }

  /**
   * Create section educator
   */
  @Post('educator')
  @ApiOperation({ summary: 'Create section educator' })
  @ApiResponse({ status: 201, description: 'Section educator created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Educator already added to section' })
  async createEducator(@Body() dto: CreateSectionEducatorDto) {
    const data = await this.sectionService.createEducator(dto);
    return { success: true, message: 'Section educator created successfully', data };
  }

  /**
   * Create enrollment
   */
  @Post('enrollment')
  @ApiOperation({ summary: 'Create enrollment (enroll student to section)' })
  @ApiResponse({ status: 201, description: 'Enrollment created successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 409, description: 'Student already enrolled in section' })
  async createEnrollment(@Body() dto: CreateEnrollmentDto) {
    const data = await this.sectionService.createEnrollment(dto);
    return { success: true, message: 'Enrollment created successfully', data };
  }

  // ========== Update Endpoints ==========

  /**
   * Update section
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update section by ID' })
  @ApiResponse({ status: 200, description: 'Section updated successfully' })
  @ApiResponse({ status: 404, description: 'Section not found' })
  async updateSection(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto) {
    const data = await this.sectionService.updateSection(id, dto);
    return { success: true, message: 'Section updated successfully', data };
  }

  /**
   * Update section with schedule together
   */
  @Put('section-schedule/update')
  @ApiOperation({ summary: 'Update section with schedule together' })
  @ApiResponse({ status: 200, description: 'Section and schedule updated successfully' })
  @ApiResponse({ status: 400, description: 'Missing section_id' })
  async updateSectionSchedule(@Body() dto: UpdateSectionScheduleDto) {
    const data = await this.sectionService.updateSectionSchedule(dto);
    return { success: true, message: 'Section and schedule updated successfully', data };
  }

  /**
   * Update section educator
   */
  @Put('educator/update')
  @ApiOperation({ summary: 'Update section educator' })
  @ApiResponse({ status: 200, description: 'Section educator updated successfully' })
  @ApiResponse({ status: 404, description: 'Section educator not found' })
  @ApiResponse({ status: 409, description: 'Duplicate educator in section' })
  async updateEducator(@Body() dto: UpdateSectionEducatorDto) {
    const data = await this.sectionService.updateEducator(dto);
    return { success: true, message: 'Section educator updated successfully', data };
  }

  /**
   * Update enrollment
   */
  @Put('enrollment/update')
  @ApiOperation({ summary: 'Update enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment updated successfully' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  @ApiResponse({ status: 409, description: 'Duplicate enrollment' })
  async updateEnrollment(@Body() dto: UpdateEnrollmentDto) {
    const data = await this.sectionService.updateEnrollment(dto);
    return { success: true, message: 'Enrollment updated successfully', data };
  }

  // ========== Delete Endpoints ==========

  /**
   * Delete section
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete section by ID' })
  @ApiResponse({ status: 200, description: 'Section deleted successfully' })
  @ApiResponse({ status: 404, description: 'Section not found' })
  async deleteSection(@Param('id', ParseIntPipe) id: number) {
    const data = await this.sectionService.deleteSection(id);
    return { success: true, message: 'Section deleted successfully', data };
  }

  /**
   * Delete schedule
   */
  @Delete('schedule/:id')
  @ApiOperation({ summary: 'Delete schedule by ID' })
  @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async deleteSchedule(@Param('id', ParseIntPipe) id: number) {
    const data = await this.sectionService.deleteSchedule(id);
    return { success: true, message: 'Schedule deleted successfully', data };
  }

  /**
   * Delete section educator
   */
  @Post('educator/delete')
  @ApiOperation({ summary: 'Delete section educator' })
  @ApiResponse({ status: 200, description: 'Section educator deleted successfully' })
  @ApiResponse({ status: 404, description: 'No matching records found' })
  async deleteEducator(@Body() dto: DeleteSectionEducatorDto) {
    const data = await this.sectionService.deleteEducator(dto);
    return { success: true, message: 'Section educator deleted successfully', data };
  }

  /**
   * Delete enrollment
   */
  @Post('enrollment/delete')
  @ApiOperation({ summary: 'Delete enrollment' })
  @ApiResponse({ status: 200, description: 'Enrollment deleted successfully' })
  @ApiResponse({ status: 404, description: 'No matching records found' })
  async deleteEnrollment(@Body() dto: DeleteEnrollmentDto) {
    const data = await this.sectionService.deleteEnrollment(dto);
    return { success: true, message: 'Enrollment deleted successfully', data };
  }
}
