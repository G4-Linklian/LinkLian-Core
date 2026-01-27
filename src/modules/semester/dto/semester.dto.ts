// semester.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { SemesterStatus } from '../entities/semester.entity';

/**
 * DTO for searching semesters with filters
 */
export class SearchSemesterDto {
  @ApiPropertyOptional({ description: 'Semester ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  semester_id?: number;

  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Semester name', example: '1/2567' })
  @IsOptional()
  @IsString()
  semester?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)', example: '2024-05-01' })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)', example: '2024-09-30' })
  @IsOptional()
  @IsString()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Status', example: 'active', enum: SemesterStatus })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'semester_id' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ description: 'Sort order', example: 'ASC', enum: ['ASC', 'DESC'] })
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
}

/**
 * DTO for creating a new semester
 */
export class CreateSemesterDto {
  @ApiProperty({ description: 'Institution ID', example: 1 })
  @IsInt()
  inst_id: number;

  @ApiProperty({ description: 'Semester name', example: '1/2567' })
  @IsString()
  semester: string;

  @ApiProperty({ description: 'Start date (YYYY-MM-DD)', example: '2024-05-01' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ description: 'End date (YYYY-MM-DD)', example: '2024-09-30' })
  @IsDateString()
  end_date: string;

  @ApiProperty({ description: 'Valid flag', example: true })
  @IsBoolean()
  flag_valid: boolean;

  @ApiPropertyOptional({ description: 'Status', example: 'pending', enum: SemesterStatus, default: 'pending' })
  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * DTO for updating a semester
 */
export class UpdateSemesterDto {
  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Semester name', example: '1/2567' })
  @IsOptional()
  @IsString()
  semester?: string;

  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)', example: '2024-05-01' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)', example: '2024-09-30' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Status', example: 'active', enum: SemesterStatus })
  @IsOptional()
  @IsString()
  status?: string;
}

/**
 * DTO for creating semester_subject_normalize record
 */
export class CreateSemesterSubjectDto {
  @ApiProperty({ description: 'Subject ID', example: 1 })
  @IsInt()
  subject_id: number;

  @ApiProperty({ description: 'Semester ID', example: 1 })
  @IsInt()
  semester_id: number;

  @ApiProperty({ description: 'Valid flag', example: true })
  @IsBoolean()
  flag_valid: boolean;
}

/**
 * DTO for deleting semester_subject_normalize record
 */
export class DeleteSemesterSubjectDto {
  @ApiProperty({ description: 'Subject ID', example: 1 })
  @IsInt()
  subject_id: number;

  @ApiProperty({ description: 'Semester ID', example: 1 })
  @IsInt()
  semester_id: number;
}
