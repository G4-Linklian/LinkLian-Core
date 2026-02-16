// users.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsEmail, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { UserStatus } from '../entities/user-sys.entity';

/**
 * DTO for searching users with filters and pagination
 */
export class SearchUserSysDto {
  @ApiPropertyOptional({ description: 'User Sys ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_sys_id?: number;

  @ApiPropertyOptional({ description: 'Email', example: 'user@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'First Name', example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Middle Name', example: 'William' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ description: 'Last Name', example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Phone', example: '0812345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Role ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  role_id?: number;

  @ApiPropertyOptional({ description: 'User Code', example: 'STU001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Education Level ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  edu_lev_id?: number;

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

  @ApiPropertyOptional({ description: 'User Status', example: 'active', enum: UserStatus })
  @IsOptional()
  @IsString()
  user_status?: string;

  @ApiPropertyOptional({ description: 'Learning Area ID (for role 4,5)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  learning_area_id?: number;

  @ApiPropertyOptional({ description: 'Program ID (for role 3)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  program_id?: number;

  @ApiPropertyOptional({ description: 'Keyword search for code, first_name, last_name, email', example: 'john' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'first_name' })
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
 * DTO for creating a new user
 */
export class CreateUserSysDto {
  @ApiProperty({ description: 'Email', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'First Name', example: 'John' })
  @IsString()
  first_name!: string;

  @ApiPropertyOptional({ description: 'Middle Name', example: 'William' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiProperty({ description: 'Last Name', example: 'Doe' })
  @IsString()
  last_name!: string;

  @ApiPropertyOptional({ description: 'Phone', example: '0812345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Role ID', example: 1 })
  @IsInt()
  role_id!: number;

  @ApiProperty({ description: 'User Code', example: 'STU001' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ description: 'Education Level ID', example: 1 })
  @IsOptional()
  @IsInt()
  edu_lev_id?: number;

  @ApiProperty({ description: 'Institution ID', example: 1 })
  @IsInt()
  inst_id!: number;

  @ApiPropertyOptional({ description: 'User Status', example: 'active', enum: UserStatus })
  @IsOptional()
  @IsString()
  user_status?: string;

  @ApiPropertyOptional({ description: 'Profile Picture URL', example: 'https://example.com/pic.jpg' })
  @IsOptional()
  @IsString()
  profile_pic?: string;

  @ApiPropertyOptional({ description: 'Learning Area ID (for teacher/educator)', example: 1 })
  @IsOptional()
  @IsInt()
  learning_area_id?: number;

  @ApiPropertyOptional({ description: 'Program ID (for student)', example: 1 })
  @IsOptional()
  @IsInt()
  program_id?: number;
}

/**
 * DTO for updating a user
 */
export class UpdateUserSysDto {
  @ApiPropertyOptional({ description: 'Email', example: 'user@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'First Name', example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Middle Name', example: 'William' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ description: 'Last Name', example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Phone', example: '0812345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Role ID', example: 1 })
  @IsOptional()
  @IsInt()
  role_id?: number;

  @ApiPropertyOptional({ description: 'User Code', example: 'STU001' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Education Level ID', example: 1 })
  @IsOptional()
  @IsInt()
  edu_lev_id?: number;

  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional()
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'User Status', example: 'active', enum: UserStatus })
  @IsOptional()
  @IsString()
  user_status?: string;

  @ApiPropertyOptional({ description: 'Profile Picture URL', example: 'https://example.com/pic.jpg' })
  @IsOptional()
  @IsString()
  profile_pic?: string;

  @ApiPropertyOptional({ description: 'Learning Area ID', example: 1 })
  @IsOptional()
  @IsInt()
  learning_area_id?: number;

  @ApiPropertyOptional({ description: 'Program ID', example: 1 })
  @IsOptional()
  @IsInt()
  program_id?: number;
}
