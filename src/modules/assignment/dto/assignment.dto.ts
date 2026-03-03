// assignment.dto.ts
import { IsInt, IsOptional, IsString , IsArray, IsNumber} from 'class-validator';
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
  section_id!: number;

  @ApiPropertyOptional({
    description: 'Role of user (student / teacher)',
    example: 'student',
  })
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
  post_id?: number;

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
  assignment_id?: number;

  @IsString()
  group_name?: string;

  @IsArray()
  @IsInt({ each: true })
  member_ids!: number[];
}

export class GetGroupDto {
  @ApiProperty({
    description: 'Assignment ID',
    example: 3,
  })
  @Type(() => Number)
  @IsInt()
  assignment_id!: number;
}

// assignment.dto.ts
export class UpdateGroupDto {
  @IsInt()
  assignment_id?: number;

  @IsInt()
  group_id?: number;

  @IsString()
  group_name?: string;

  @IsArray()
  @IsInt({ each: true })
  member_ids!: number[];
}

/**
 * Response interface for student assignment card
 */
export interface StudentAssignmentResponse {
  assignment_id: number;
  post_id: number;
  title: string;
  subject_name: string;
  assignment_type: string; // 'งานเดี่ยว' | 'งานกลุ่ม'
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

export class SearchAssignmentsDto {
  @IsNumber()
  @Type(() => Number)
  section_id!: number;

  @IsString()
  keyword!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 50;
}

export class CreateSubmissionDto {
  @ApiProperty({ description: 'Assignment ID', example: 123 })
  @IsInt()
  @Type(() => Number)
  assignment_id!: number;

  @ApiProperty({ description: 'Group ID (student_group)', example: 67 })
  @IsInt()
  @Type(() => Number)
  group_id!: number;

  @ApiPropertyOptional({
    description: 'Uploaded files (from blob storage)',
    example: [
      {
        file_url: 'https://blob.storage.net/student-submission/uuid-123.pdf',
        original_name: 'homework1.pdf',
        file_type: 'pdf',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  files?: SubmissionFileDto[];
}

export class SubmissionFileDto {
  @ApiProperty({
    description: 'File URL from blob storage',
    example: 'https://blob.storage.net/student-submission/uuid-123.pdf',
  })
  @IsString()
  file_url!: string;

  @ApiProperty({ description: 'Original file name', example: 'homework1.pdf' })
  @IsString()
  original_name!: string;

  @ApiProperty({ description: 'File extension', example: 'pdf' })
  @IsString()
  file_type!: string;
}

export class UpdateSubmissionDto {
  @ApiProperty({ description: 'Existing submission ID to update', example: 42 })
  @IsInt()
  @Type(() => Number)
  submission_id!: number;

  @ApiProperty({ description: 'Assignment ID', example: 123 })
  @IsInt()
  @Type(() => Number)
  assignment_id!: number;

  @ApiProperty({ description: 'Group ID (student_group)', example: 67 })
  @IsInt()
  @Type(() => Number)
  group_id!: number;

  @ApiPropertyOptional({
    description: 'New files to replace old attachments',
    example: [
      {
        file_url: 'https://blob.storage.net/student-submission/uuid-456.docx',
        original_name: 'homework1_v2.docx',
        file_type: 'docx',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  files?: SubmissionFileDto[];
}

export class GetSubmissionDto {
  @ApiProperty({ description: 'Submission ID', example: 42 })
  @Type(() => Number)
  @IsInt()
  submission_id!: number;
}

export class GradeSubmissionDto {
  @ApiProperty({ description: 'Submission ID to grade', example: 42 })
  @IsInt()
  @Type(() => Number)
  submission_id!: number;

  @ApiPropertyOptional({ description: 'Score for the submission', example: 8.5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  score?: number;

  @ApiPropertyOptional({ description: 'Feedback comment from teacher', example: 'ทำได้ดีมาก แต่ควรเพิ่มรายละเอียด' })
  @IsOptional()
  @IsString()
  feedback?: string;
}
