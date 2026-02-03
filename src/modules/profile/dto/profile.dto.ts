// profile.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating user profile
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'First Name', example: 'John', required: false })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Middle Name', example: 'David', required: false })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ description: 'Last Name', example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '0812345678', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Profile Picture URL', example: 'https://example.com/pic.jpg', required: false })
  @IsOptional()
  @IsString()
  profile_pic?: string;
}

/**
 * Interface for education info in profile response
 */
export interface EducationInfo {
  type: 'high_school' | 'university';
  level: string;
  classroom: string;
  study_plan?: string;
  faculty?: string;
  program?: string;
  display: string;
}

/**
 * Interface for profile response
 */
export interface ProfileResponse {
  user_sys_id: number;
  code: string;
  email: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  phone: string | null;
  profile_pic: string | null;
  role_id: number;
  role_name: string;
  role_group: 'teacher' | 'student';
  education: EducationInfo | null;
}
