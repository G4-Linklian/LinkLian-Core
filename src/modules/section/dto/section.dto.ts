// section.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { DayOfWeek } from '../entities/section-schedule.entity';
import { EducatorPosition } from '../entities/section-educator.entity';

// ========== Search DTOs ==========

/**
 * DTO for searching sections (master view with student count)
 */
export class SearchSectionMasterDto {
  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({ description: 'Semester ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semester_id?: number;

  @ApiPropertyOptional({ description: 'Subject ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subject_id?: number;

  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Section Name', example: 'Section A' })
  @IsOptional()
  @IsString()
  section_name?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({
    description: 'Include student count',
    example: true,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  count_student?: boolean;

  @ApiPropertyOptional({
    description: 'Keyword search for section_name',
    example: 'Section',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'section_name',
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Limit', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

  @ApiPropertyOptional({ description: 'Hour per week', example: 3 })
  @IsOptional()
  @IsInt()
  hour_per_week?: number;
}

/**
 * DTO for searching sections with schedule and room details
 */
export class SearchSectionDto {
  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({ description: 'Semester ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semester_id?: number;

  @ApiPropertyOptional({ description: 'Subject ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subject_id?: number;

  @ApiPropertyOptional({ description: 'Schedule ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  schedule_id?: number;

  @ApiPropertyOptional({
    description: 'Day of week',
    example: 'Monday',
    enum: DayOfWeek,
  })
  @IsOptional()
  @IsString()
  day_of_week?: string;

  @ApiPropertyOptional({
    description: 'Start time (HH:mm:ss)',
    example: '08:00:00',
  })
  @IsOptional()
  @IsString()
  start_time?: string;

  @ApiPropertyOptional({
    description: 'End time (HH:mm:ss)',
    example: '10:00:00',
  })
  @IsOptional()
  @IsString()
  end_time?: string;

  @ApiPropertyOptional({ description: 'Room Location ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  room_location_id?: number;

  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({
    description: 'Sort by field',
    example: 'section_name',
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Limit', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

  @ApiPropertyOptional({ description: 'Hour per week', example: 3 })
  @IsOptional()
  @IsInt()
  hour_per_week?: number;
}

/**
 * DTO for searching schedules
 */
export class SearchScheduleDto {
  @ApiPropertyOptional({ description: 'Schedule ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  schedule_id?: number;

  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({
    description: 'Day of week',
    example: 'Monday',
    enum: DayOfWeek,
  })
  @IsOptional()
  @IsString()
  day_of_week?: string;

  @ApiPropertyOptional({
    description: 'Start time (HH:mm:ss)',
    example: '08:00:00',
  })
  @IsOptional()
  @IsString()
  start_time?: string;

  @ApiPropertyOptional({
    description: 'End time (HH:mm:ss)',
    example: '10:00:00',
  })
  @IsOptional()
  @IsString()
  end_time?: string;

  @ApiPropertyOptional({ description: 'Room Location ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  room_location_id?: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Hour per week', example: 3 })
  @IsOptional()
  @IsInt()
  hour_per_week?: number;
}

/**
 * DTO for searching section educators
 */
export class SearchSectionEducatorDto {
  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({ description: 'Semester ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semester_id?: number;

  @ApiPropertyOptional({ description: 'Subject ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subject_id?: number;

  @ApiPropertyOptional({ description: 'User Sys ID (educator)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_sys_id?: number;

  @ApiPropertyOptional({ description: 'Role ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  role_id?: number;

  @ApiPropertyOptional({ description: 'Role Name', example: 'Teacher' })
  @IsOptional()
  @IsString()
  role_name?: string;

  @ApiPropertyOptional({ description: 'Role Type', example: 'educator' })
  @IsOptional()
  @IsString()
  role_type?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({
    description: 'Join building info',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  join_building?: boolean;

  @ApiPropertyOptional({
    description: 'From profile view',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  from_profile?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'educator_id' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Limit', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

  @ApiPropertyOptional({ description: 'Hour per week', example: 3 })
  @IsOptional()
  @IsInt()
  hour_per_week?: number;
}

/**
 * DTO for searching enrollments
 */
export class SearchEnrollmentDto {
  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({ description: 'Semester ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semester_id?: number;

  @ApiPropertyOptional({ description: 'Subject ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subject_id?: number;

  @ApiPropertyOptional({ description: 'User Sys ID (student)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_sys_id?: number;

  @ApiPropertyOptional({ description: 'Role ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  role_id?: number;

  @ApiPropertyOptional({ description: 'Role Name', example: 'Student' })
  @IsOptional()
  @IsString()
  role_name?: string;

  @ApiPropertyOptional({ description: 'Role Type', example: 'student' })
  @IsOptional()
  @IsString()
  role_type?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'first_name' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
  })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Limit', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

  @ApiPropertyOptional({ description: 'Hour per week', example: 3 })
  @IsOptional()
  @IsInt()
  hour_per_week?: number;

  @ApiPropertyOptional({
    description: 'Keyword search for first_name, last_name, or username',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Education Level ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  edu_level_id?: number;

  @ApiPropertyOptional({ description: 'Program ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  program_id?: number;

  @ApiPropertyOptional({ description: 'Education Level Detail ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  edu_lev_id?: number;

  @ApiPropertyOptional({ description: 'User Status', example: 'Active' })
  @IsOptional()
  @IsString()
  user_status?: string;
}

// ========== Create DTOs ==========

/**
 * DTO for creating a section
 */
export class CreateSectionDto {
  @ApiProperty({ description: 'Subject ID', example: 1 })
  @IsInt()
  subject_id!: number;

  @ApiProperty({ description: 'Semester ID', example: 1 })
  @IsInt()
  semester_id!: number;

  @ApiPropertyOptional({ description: 'Section Name', example: 'Section A' })
  @IsOptional()
  @IsString()
  section_name?: string;
}

/**
 * DTO for creating a schedule
 */
export class CreateScheduleDto {
  @ApiProperty({ description: 'Section ID', example: 1 })
  @IsInt()
  section_id!: number;

  @ApiProperty({
    description: 'Day of week',
    example: 'Monday',
    enum: DayOfWeek,
  })
  @IsString()
  day_of_week!: string;

  @ApiProperty({ description: 'Start time (HH:mm:ss)', example: '08:00:00' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'Invalid time format (HH:mm:ss)',
  })
  @IsString()
  start_time!: string;

  @ApiProperty({ description: 'End time (HH:mm:ss)', example: '10:00:00' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'Invalid time format (HH:mm:ss)',
  })
  @IsString()
  end_time!: string;

  @ApiProperty({ description: 'Room Location ID', example: 1 })
  @IsInt()
  room_location_id!: number;
}

/**
 * DTO for creating section with schedule together
 */
export class CreateSectionScheduleDto {
  @ApiProperty({ description: 'Subject ID', example: 1 })
  @IsInt()
  subject_id!: number;

  @ApiProperty({ description: 'Semester ID', example: 1 })
  @IsInt()
  semester_id!: number;

  @ApiPropertyOptional({ description: 'Section Name', example: 'Section A' })
  @IsOptional()
  @IsString()
  section_name?: string;

  @ApiPropertyOptional({
    description: 'Day of week',
    example: 'Monday',
    enum: DayOfWeek,
  })
  @IsOptional()
  @IsString()
  day_of_week?: string;

  @ApiPropertyOptional({
    description: 'Start time (HH:mm:ss)',
    example: '08:00:00',
  })
  @IsOptional()
  @IsString()
  start_time?: string;

  @ApiPropertyOptional({
    description: 'End time (HH:mm:ss)',
    example: '10:00:00',
  })
  @IsOptional()
  @IsString()
  end_time?: string;

  @ApiPropertyOptional({ description: 'Room Location ID', example: 1 })
  @IsOptional()
  @IsInt()
  room_location_id?: number;
}

/**
 * DTO for creating section educator
 */
export class CreateSectionEducatorDto {
  @ApiProperty({ description: 'Section ID', example: 1 })
  @IsInt()
  section_id!: number;

  @ApiProperty({ description: 'User Sys ID (educator)', example: 1 })
  @IsInt()
  user_sys_id!: number;

  @ApiProperty({
    description: 'Position',
    example: 'main',
    enum: EducatorPosition,
  })
  @IsString()
  position!: string;
}

/**
 * DTO for creating enrollment
 */
export class CreateEnrollmentDto {
  @ApiProperty({ description: 'Section ID', example: 1 })
  @IsInt()
  section_id!: number;

  @ApiProperty({ description: 'User Sys ID (student)', example: 1 })
  @IsInt()
  user_sys_id!: number;
}

// ========== Update DTOs ==========

/**
 * DTO for updating a section
 */
export class UpdateSectionDto {
  @ApiPropertyOptional({ description: 'Subject ID', example: 1 })
  @IsOptional()
  @IsInt()
  subject_id?: number;

  @ApiPropertyOptional({ description: 'Semester ID', example: 1 })
  @IsOptional()
  @IsInt()
  semester_id?: number;

  @ApiPropertyOptional({ description: 'Section Name', example: 'Section A' })
  @IsOptional()
  @IsString()
  section_name?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for updating section with schedule together
 */
export class UpdateSectionScheduleDto {
  @ApiProperty({ description: 'Section ID', example: 1 })
  @IsInt()
  section_id!: number;

  @ApiPropertyOptional({ description: 'Schedule ID', example: 1 })
  @IsOptional()
  @IsInt()
  schedule_id?: number;

  @ApiPropertyOptional({ description: 'Subject ID', example: 1 })
  @IsOptional()
  @IsInt()
  subject_id?: number;

  @ApiPropertyOptional({ description: 'Semester ID', example: 1 })
  @IsOptional()
  @IsInt()
  semester_id?: number;

  @ApiPropertyOptional({ description: 'Section Name', example: 'Section A' })
  @IsOptional()
  @IsString()
  section_name?: string;

  @ApiPropertyOptional({
    description: 'Day of week',
    example: 'Monday',
    enum: DayOfWeek,
  })
  @IsOptional()
  @IsString()
  day_of_week?: string;

  @ApiPropertyOptional({
    description: 'Start time (HH:mm:ss)',
    example: '08:00:00',
  })
  @IsOptional()
  @IsString()
  start_time?: string;

  @ApiPropertyOptional({
    description: 'End time (HH:mm:ss)',
    example: '10:00:00',
  })
  @IsOptional()
  @IsString()
  end_time?: string;

  @ApiPropertyOptional({ description: 'Room Location ID', example: 1 })
  @IsOptional()
  @IsInt()
  room_location_id?: number;

  @ApiPropertyOptional({ description: 'Hour per week', example: 3 })
  @IsOptional()
  @IsInt()
  hour_per_week?: number;
}

/**
 * DTO for updating section educator
 */
export class UpdateSectionEducatorDto {
  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({ description: 'User Sys ID (educator)', example: 1 })
  @IsOptional()
  @IsInt()
  user_sys_id?: number;

  @ApiPropertyOptional({
    description: 'Position',
    example: 'main',
    enum: EducatorPosition,
  })
  @IsOptional()
  @IsString()
  position?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for updating enrollment
 */
export class UpdateEnrollmentDto {
  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({ description: 'User Sys ID (student)', example: 1 })
  @IsOptional()
  @IsInt()
  user_sys_id?: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

// ========== Delete DTOs ==========

/**
 * DTO for deleting section educator
 */
export class DeleteSectionEducatorDto {
  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({ description: 'User Sys ID (educator)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_sys_id?: number;
}

/**
 * DTO for deleting enrollment
 */
export class DeleteEnrollmentDto {
  @ApiPropertyOptional({ description: 'Section ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  section_id?: number;

  @ApiPropertyOptional({ description: 'User Sys ID (student)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_sys_id?: number;
}
