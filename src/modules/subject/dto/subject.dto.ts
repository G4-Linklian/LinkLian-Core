// subject.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

/**
 * DTO for searching subjects with filters and pagination
 */
export class SearchSubjectDto {
  @ApiPropertyOptional({ description: 'Subject ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subject_id?: number;

  @ApiPropertyOptional({ description: 'Learning Area ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  learning_area_id?: number;

  @ApiPropertyOptional({ description: 'Subject Code', example: 'CS101' })
  @IsOptional()
  @IsString()
  subject_code?: string;

  @ApiPropertyOptional({ description: 'Thai Name', example: 'วิทยาศาสตร์คอมพิวเตอร์' })
  @IsOptional()
  @IsString()
  name_th?: string;

  @ApiPropertyOptional({ description: 'English Name', example: 'Computer Science' })
  @IsOptional()
  @IsString()
  name_en?: string;

  @ApiPropertyOptional({ description: 'Credit', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  credit?: number;

  @ApiPropertyOptional({ description: 'Hours per week', example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  hour_per_week?: number;

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

  @ApiPropertyOptional({ description: 'Keyword search for subject_code or name_th', example: 'CS' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'subject_code' })
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
 * DTO for creating a new subject
 */
export class CreateSubjectDto {
  @ApiProperty({ description: 'Learning Area ID', example: 1 })
  @IsInt()
  learning_area_id!: number;

  @ApiProperty({ description: 'Subject Code', example: 'CS101' })
  @IsString()
  subject_code!: string;

  @ApiProperty({ description: 'Thai Name', example: 'วิทยาศาสตร์คอมพิวเตอร์' })
  @IsString()
  name_th!: string;

  @ApiPropertyOptional({ description: 'English Name', example: 'Computer Science' })
  @IsOptional()
  @IsString()
  name_en?: string;

  @ApiProperty({ description: 'Credit', example: 3 })
  @IsNumber()
  credit!: number;

  @ApiProperty({ description: 'Hours per week', example: 3 })
  @IsNumber()
  hour_per_week!: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Created at timestamp', example: '2024-01-01T00:00:00Z' })
  created_at?: Date;

  @ApiPropertyOptional({ description: 'Updated at timestamp', example: '2024-01-01T00:00:00Z' })
  updated_at?: Date;
}

/**
 * DTO for updating a subject
 */
export class UpdateSubjectDto {
  @ApiPropertyOptional({ description: 'Learning Area ID', example: 1 })
  @IsOptional()
  @IsInt()
  learning_area_id?: number;

  @ApiPropertyOptional({ description: 'Subject Code', example: 'CS101' })
  @IsOptional()
  @IsString()
  subject_code?: string;

  @ApiPropertyOptional({ description: 'Thai Name', example: 'วิทยาศาสตร์คอมพิวเตอร์' })
  @IsOptional()
  @IsString()
  name_th?: string;

  @ApiPropertyOptional({ description: 'English Name', example: 'Computer Science' })
  @IsOptional()
  @IsString()
  name_en?: string;

  @ApiPropertyOptional({ description: 'Credit', example: 3 })
  @IsOptional()
  @IsNumber()
  credit?: number;

  @ApiPropertyOptional({ description: 'Hours per week', example: 3 })
  @IsOptional()
  @IsNumber()
  hour_per_week?: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}
