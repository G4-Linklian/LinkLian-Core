// learning-area.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

/**
 * DTO for searching learning areas with filters and pagination
 */
export class SearchLearningAreaDto {
  @ApiPropertyOptional({ description: 'Learning Area ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  learning_area_id?: number;

  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Learning Area Name', example: 'Mathematics' })
  @IsOptional()
  @IsString()
  learning_area_name?: string;

  @ApiPropertyOptional({ description: 'Remark', example: 'Core subject' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Include subject count', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  subject_count?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'learning_area_name' })
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

  @ApiPropertyOptional({ description: 'Keyword search for learning_area_name, remark', example: 'Math' })
  @IsOptional()
  @IsString()
  keyword?: string;
}

/**
 * DTO for creating a new learning area
 */
export class CreateLearningAreaDto {
  @ApiProperty({ description: 'Institution ID', example: 1 })
  @IsInt()
  inst_id!: number;

  @ApiProperty({ description: 'Learning Area Name', example: 'Mathematics' })
  @IsString()
  learning_area_name!: string;

  @ApiPropertyOptional({ description: 'Remark', example: 'Core subject' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * DTO for updating a learning area
 */
export class UpdateLearningAreaDto {
  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Learning Area Name', example: 'Mathematics' })
  @IsOptional()
  @IsString()
  learning_area_name?: string;

  @ApiPropertyOptional({ description: 'Remark', example: 'Core subject' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for creating user_sys_learning_area_normalize record
 */
export class CreateLearningAreaUserSysDto {
  @ApiProperty({ description: 'Learning Area ID', example: 1 })
  @IsInt()
  learning_area_id!: number;

  @ApiProperty({ description: 'User Sys ID', example: 1 })
  @IsInt()
  user_sys_id!: number;
}

/**
 * DTO for updating user_sys_learning_area_normalize record
 */
export class UpdateLearningAreaUserSysDto {
  @ApiProperty({ description: 'User Sys ID', example: 1 })
  @IsInt()
  user_sys_id!: number;

  @ApiProperty({ description: 'Learning Area ID', example: 1 })
  @IsInt()
  learning_area_id!: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for deleting user_sys_learning_area_normalize record
 */
export class DeleteLearningAreaUserSysDto {
  @ApiProperty({ description: 'Learning Area ID', example: 1 })
  @IsInt()
  learning_area_id!: number;

  @ApiProperty({ description: 'User Sys ID', example: 1 })
  @IsInt()
  user_sys_id!: number;
}
