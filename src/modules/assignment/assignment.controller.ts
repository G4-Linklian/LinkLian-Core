// assignment.controller.ts
import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AssignmentService } from './assignment.service';
import { GetClassAssignmentsDto, GetPostAssignmentDto, CreateGroupDto, GetGroupDto , UpdateGroupDto, SearchAssignmentsDto, CreateSubmissionDto, UpdateSubmissionDto, GetSubmissionDto, GradeSubmissionDto } from './dto/assignment.dto';

@ApiTags('Assignment')
@Controller('assignment')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  /**
   * Get assignments for a section
   * Student: returns submission status per assignment
   * Teacher: returns submitted_count / total_students
   */
  @Get()
  @ApiOperation({ summary: 'Get assignments in a class/section' })
  @ApiHeader({
    name: 'x-user-id',
    description: 'User ID from auth',
    required: true,
  })
  @ApiQuery({ name: 'section_id', description: 'Section ID', required: true })
  @ApiQuery({
    name: 'role',
    description: 'User role (student / teacher)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Assignments retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  getClassAssignments(
    @Headers('x-user-id') userId: string,
    @Query() dto: GetClassAssignmentsDto,
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }
    return this.assignmentService.getClassAssignments(parsedUserId, dto);
  }

  @Post('create-group')
  @ApiHeader({ name: 'x-user-id', required: true })
  async createGroup(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateGroupDto,
  ) {
    try {
      const parsedUserId = Number(userId);

      if (isNaN(parsedUserId)) {
        throw new BadRequestException('Invalid user ID');
      }

      return await this.assignmentService.createGroup(parsedUserId, dto);
    } catch (error) {
      console.error('[Controller] createGroup error:', error);

      if (error.message === 'You must be a member of the group you create') {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  @Post('update-group')
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiOperation({ summary: 'Update group name and members' })
  async updateGroup(
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    const parsedUserId = Number(userId);

    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }

    try {
      console.log('[Controller] updateGroup called:', {
        userId: parsedUserId,
        dto,
      });

      const result = await this.assignmentService.updateGroup(
        parsedUserId,
        dto,
      );

      console.log('[Controller] updateGroup result:', result);

      return result;
    } catch (error) {
      console.error('[Controller] updateGroup error:', error);

      if (error.message === 'You cannot remove yourself from the group') {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  @Get('group')
  getGroup(@Headers('x-user-id') userId: string, @Query() dto: GetGroupDto) {
    const parsedUserId = Number(userId);

    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid or missing x-user-id');
    }

    return this.assignmentService.getGroup(parsedUserId, dto.assignment_id);
  }

  // assignment.controller.ts
  @Get('all-groups')
  @ApiOperation({ summary: 'Get all groups for an assignment' })
  @ApiQuery({ name: 'assignment_id', required: true })
  getAllGroups(@Query() dto: GetGroupDto) {
    return this.assignmentService.getAllGroups(dto.assignment_id);
  }

@Get('search')
@ApiOperation({ summary: 'Search assignments by keyword' })
@ApiHeader({ name: 'x-user-id', required: true })
@ApiQuery({ name: 'section_id', required: true })
@ApiQuery({ name: 'keyword', required: true })
@ApiQuery({ name: 'role', required: false })
@ApiQuery({ name: 'limit', required: false })
searchAssignments(
  @Headers('x-user-id') userId: string,
  @Query() dto: SearchAssignmentsDto,
) {
  const parsedUserId = parseInt(userId, 10);
  if (isNaN(parsedUserId)) {
    throw new BadRequestException('Invalid user ID');
  }
  return this.assignmentService.searchAssignments(
    parsedUserId,
    dto.section_id,
    dto.keyword,
    dto.role || 'student',
    dto.limit || 50,
  );
}

  /**
   * Get single assignment post (for assignment submission page)
   */
  @Get('post')
  @ApiOperation({
    summary: 'Get assignment post detail by post_id',
  })
  @ApiHeader({
    name: 'x-user-id',
    description: 'User ID from auth',
    required: true,
  })
  @ApiQuery({
    name: 'post_id',
    description: 'Post ID of assignment',
    required: true,
  })
  @ApiQuery({
    name: 'role',
    description: 'User role (student / teacher)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Assignment post retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input',
  })
  async getPostAssignment(
    @Headers('x-user-id') userId: string,
    @Query() dto: GetPostAssignmentDto,
  ) {
    const parsedUserId = parseInt(userId, 10);

    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }

    if (!dto.post_id) {
      throw new BadRequestException('post_id is required');
    }

    return this.assignmentService.getPostAssignment(
      dto.post_id,
      parsedUserId,
      dto.role,
    );
  }

  /**
   * Create a new submission for an assignment
   */
  @Get('submission')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get submission detail by submission_id' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiQuery({ name: 'submission_id', description: 'Submission ID', required: true })
  @ApiResponse({ status: 200, description: 'Submission retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Submission not found' })
  async getSubmission(
    @Headers('x-user-id') userId: string,
    @Query() dto: GetSubmissionDto,
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }

    return this.assignmentService.getSubmission(parsedUserId, dto.submission_id);
  }

  /**
   * Create a new submission for an assignment (POST)
   */
  @Post('create-submission')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit an assignment' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiResponse({ status: 201, description: 'Submission created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or already submitted' })
  async createSubmission(
    @Headers('x-user-id') userId: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }

    return this.assignmentService.createSubmission(parsedUserId, dto);
  }

  /**
   * Update an existing submission (before due date)
   */
  @Post('update-submission')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an existing submission (before due date)' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiResponse({ status: 200, description: 'Submission updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or past due date' })
  async updateSubmission(
    @Headers('x-user-id') userId: string,
    @Body() dto: UpdateSubmissionDto,
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }

    return this.assignmentService.updateSubmission(parsedUserId, dto);
  }

  /**
   * Grade a submission (teacher only)
   */
  @Post('grade-submission')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Grade a submission (score + feedback)' })
  @ApiHeader({ name: 'x-user-id', required: true })
  @ApiResponse({ status: 200, description: 'Submission graded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async gradeSubmission(
    @Headers('x-user-id') userId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    const parsedUserId = parseInt(userId, 10);
    if (isNaN(parsedUserId)) {
      throw new BadRequestException('Invalid user ID');
    }

    return this.assignmentService.gradeSubmission(parsedUserId, dto);
  }
}
