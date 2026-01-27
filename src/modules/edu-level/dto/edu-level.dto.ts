// edu-level.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { EduType } from '../entities/edu-level.entity';

/**
 * DTO for searching edu_level master data
 */
export class SearchEduLevelMasterDto {
  @ApiPropertyOptional({ description: 'Edu Level ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  edu_lev_id?: number;

  @ApiPropertyOptional({ description: 'Level name', example: 'ป.1' })
  @IsOptional()
  @IsString()
  level_name?: string;

  @ApiPropertyOptional({ description: 'Education type', example: 'ประถมศึกษา', enum: EduType })
  @IsOptional()
  @IsString()
  edu_type?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for searching edu_level with program joins
 */
export class SearchEduLevelDto {
  @ApiPropertyOptional({ description: 'Edu Level ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  edu_lev_id?: number;

  @ApiPropertyOptional({ description: 'Level name', example: 'ป.1' })
  @IsOptional()
  @IsString()
  level_name?: string;

  @ApiPropertyOptional({ description: 'Education type', example: 'ประถมศึกษา', enum: EduType })
  @IsOptional()
  @IsString()
  edu_type?: string;

  @ApiPropertyOptional({ description: 'Program ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  program_id?: number;

  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Parent ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parent_id?: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'level_name' })
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
 * DTO for creating a new edu_level
 */
export class CreateEduLevelDto {
  @ApiProperty({ description: 'Level name', example: 'ป.1' })
  @IsString()
  level_name: string;

  @ApiProperty({ description: 'Education type', example: 'ประถมศึกษา', enum: EduType })
  @IsString()
  edu_type: string;
}

/**
 * DTO for updating an edu_level
 */
export class UpdateEduLevelDto {
  @ApiPropertyOptional({ description: 'Level name', example: 'ป.1' })
  @IsOptional()
  @IsString()
  level_name?: string;

  @ApiPropertyOptional({ description: 'Education type', example: 'ประถมศึกษา', enum: EduType })
  @IsOptional()
  @IsString()
  edu_type?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for creating edu_level_program_normalize record
 */
export class CreateEduLevelNormDto {
  @ApiProperty({ description: 'Edu Level ID', example: 1 })
  @IsInt()
  edu_lev_id: number;

  @ApiProperty({ description: 'Program ID', example: 1 })
  @IsInt()
  program_id: number;
}

/**
 * DTO for deleting edu_level_program_normalize record
 */
export class DeleteEduLevelNormDto {
  @ApiProperty({ description: 'Edu Level ID', example: 1 })
  @IsInt()
  edu_lev_id: number;

  @ApiProperty({ description: 'Program ID', example: 1 })
  @IsInt()
  program_id: number;
}
