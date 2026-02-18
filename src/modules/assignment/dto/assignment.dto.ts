// assignment.dto.ts
import { IsInt, IsOptional, IsString , IsArray} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';


/**
 * DTO for getting assignments in a section
 * Used by both student and teacher roles
 */
export class GetClassAssignmentsDto {
  @ApiProperty({ description: 'Section ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  section_id: number;

  @ApiPropertyOptional({ description: 'Role of user (student / teacher)', example: 'student' })
  @IsOptional()
  @IsString()
  role?: string;

    @ApiPropertyOptional({ description: 'offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

    @ApiPropertyOptional({ description: 'limit', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}

export class GetPostAssignmentDto {
  @ApiProperty({
    description: 'Post ID ของ assignment ที่กดมาจาก card',
    example: 123,
  })
  @Type(() => Number)
  @IsInt()
  post_id: number;

  @ApiPropertyOptional({
    description: 'Role ของผู้ใช้ (student / teacher)',
    example: 'student',
  })
  @IsOptional()
  @IsString()
  role?: string;
}

export class CreateGroupDto {
  @IsInt()
  assignment_id: number;

  @IsString()
  group_name: string;

  @IsArray()
  @IsInt({ each: true })
  member_ids: number[];
}

export class GetGroupDto {
  @ApiProperty({
    description: 'Assignment ID',
    example: 3,
  })
  @Type(() => Number)
  @IsInt()
  assignment_id: number;
}

// assignment.dto.ts
export class UpdateGroupDto {
  @IsInt()
  assignment_id: number;

  @IsInt()
  group_id: number;

  @IsString()
  group_name: string;

  @IsArray()
  @IsInt({ each: true })
  member_ids: number[];
}

/**
 * Response interface for student assignment card
 */
export interface StudentAssignmentResponse {
  assignment_id: number;
  post_id: number;
  title: string;
  subject_name: string;
  assignment_type: string;   // 'งานเดี่ยว' | 'งานกลุ่ม'
  due_date: string | null;
  is_submitted: boolean;
  submitted_at: string | null;
  total_students: number;
  submitted_count: number;
}

/**
 * Response interface for teacher assignment card
 */
export interface TeacherAssignmentResponse {
  assignment_id: number;
  post_id: number;
  title: string;
  subject_name: string;
  assignment_type: string;
  due_date: string | null;
  total_students: number;
  submitted_count: number;
}
