// feed.dto.ts
import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for getting class feed
 */
export class GetClassFeedDto {
  @ApiProperty({ description: 'User ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  user_id: number;

  @ApiProperty({ description: 'Semester ID', example: 1 })
  @Type(() => Number)
  @IsInt()
  semester_id: number;

  @ApiProperty({
    description: 'Offset for pagination',
    example: 0,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  offset?: number = 0;

  @ApiProperty({
    description: 'Limit for pagination',
    example: 10,
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  limit?: number = 10;
}

/**
 * Interface for schedule info
 */
export interface ScheduleInfo {
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: {
    room_location_id: number | null;
    room_number: string | null;
    floor: number | null;
    room_remark: string | null;
  };
  building: {
    building_id: number | null;
    building_name: string | null;
    building_no: string | null;
    room_format: string | null;
  };
}

/**
 * Interface for student class feed response
 */
export interface StudentClassFeedResponse {
  success: boolean;
  message?: string;
  data: StudentClassFeedItem[];
}

export interface StudentClassFeedItem {
  section_id: number;
  section_name: string;
  subject_code: string;
  subject_name_th: string;
  subject_name_en: string;
  learning_area_name: string | null;
  semester: string;
  student_count: number;
  display_class_name: string;
  schedules: ScheduleInfo[];
}
/**
 * Interface for teacher class feed response
 */
export interface TeacherClassFeedResponse {
  success: boolean;
  message?: string;
  data: TeacherClassFeedItem[];
}

export interface TeacherClassFeedItem {
  section_id: number;
  section_name: string;
  subject_code: string;
  subject_name_th: string;
  subject_name_en: string;
  learning_area_name: string | null;
  semester: string;
  position: string | null;
  student_count: number;
  display_class_name: string;
  schedules: ScheduleInfo[];
}
