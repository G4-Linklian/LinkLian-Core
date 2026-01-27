// profile.dto.ts
import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating user profile
 */
export class UpdateProfileDto {
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

  @ApiPropertyOptional({ description: 'Phone (Thai format: 0XXXXXXXXX)', example: '0812345678' })
  @IsString()
  @Matches(/^(0)[0-9]{9}$/, { message: 'Invalid phone number format. Must be 10 digits starting with 0' })
  phone: string;

  @ApiPropertyOptional({ description: 'Profile Picture URL', example: 'https://example.com/pic.jpg' })
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
  study_plan?: string | null;
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
