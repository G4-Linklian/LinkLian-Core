// program.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { TreeType, ProgramType } from '../entities/program.entity';

/**
 * DTO for searching programs with filters and pagination
 */
export class SearchProgramDto {
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

  @ApiPropertyOptional({ description: 'Program Name', example: 'Computer Science' })
  @IsOptional()
  @IsString()
  program_name?: string;

  @ApiPropertyOptional({ description: 'Program Type', example: 'major', enum: ProgramType })
  @IsOptional()
  @IsString()
  program_type?: string;

  @ApiPropertyOptional({ description: 'Parent ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parent_id?: number;

  @ApiPropertyOptional({ description: 'Parent IDs (for filtering)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parent_ids?: number;

  @ApiPropertyOptional({ description: 'Tree Type', example: 'leaf', enum: TreeType })
  @IsOptional()
  @IsString()
  tree_type?: string;

  @ApiPropertyOptional({ description: 'Institution Type', example: 'school' })
  @IsOptional()
  @IsString()
  inst_type?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Include children count', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  children_count?: boolean;

  @ApiPropertyOptional({ description: 'Children type filter', example: 'leaf' })
  @IsOptional()
  @IsString()
  children_type?: string;

  @ApiPropertyOptional({ description: 'Search keyword for program name', example: 'science' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'program_name' })
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
 * DTO for creating a new program
 */
export class CreateProgramDto {
  @ApiProperty({ description: 'Institution ID', example: 1 })
  @IsInt()
  inst_id!: number;

  @ApiProperty({ description: 'Program Name', example: 'Computer Science' })
  @IsString()
  program_name!: string;

  @ApiProperty({ description: 'Program Type', example: 'major', enum: ProgramType })
  @IsString()
  program_type!: string;

  @ApiProperty({ description: 'Tree Type', example: 'leaf', enum: TreeType })
  @IsString()
  tree_type!: string;

  @ApiPropertyOptional({ description: 'Parent ID', example: 1 })
  @IsOptional()
  @IsInt()
  parent_id?: number;

  @ApiPropertyOptional({ description: 'Remark', example: 'Main program' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * DTO for updating a program
 */
export class UpdateProgramDto {
  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Program Name', example: 'Computer Science' })
  @IsOptional()
  @IsString()
  program_name?: string;

  @ApiPropertyOptional({ description: 'Program Type', example: 'major', enum: ProgramType })
  @IsOptional()
  @IsString()
  program_type?: string;

  @ApiPropertyOptional({ description: 'Parent ID', example: 1 })
  @IsOptional()
  @IsInt()
  parent_id?: number;

  @ApiPropertyOptional({ description: 'Remark', example: 'Main program' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for creating user_sys_program_normalize record
 */
export class CreateProgramUserSysDto {
  @ApiProperty({ description: 'Program ID', example: 1 })
  @IsInt()
  program_id!: number;

  @ApiProperty({ description: 'User Sys ID', example: 1 })
  @IsInt()
  user_sys_id!: number;
}

/**
 * DTO for updating user_sys_program_normalize record
 */
export class UpdateProgramUserSysDto {
  @ApiProperty({ description: 'User Sys ID', example: 1 })
  @IsInt()
  user_sys_id!: number;

  @ApiPropertyOptional({ description: 'Program ID', example: 1 })
  @IsOptional()
  @IsInt()
  program_id?: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

/**
 * DTO for deleting user_sys_program_normalize record
 */
export class DeleteProgramUserSysDto {
  @ApiProperty({ description: 'Program ID', example: 1 })
  @IsInt()
  program_id!: number;

  @ApiProperty({ description: 'User Sys ID', example: 1 })
  @IsInt()
  user_sys_id!: number;
}
