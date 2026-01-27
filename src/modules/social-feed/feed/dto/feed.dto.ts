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
  section_id: number;
  section_name: string;
  subject_code: string;
  subject_name_th: string;
  subject_name_en: string;
  learning_area_name: string | null;
  semester: string;
  edu_type: string | null;
  level_num: number | null;
  level_name: string | null;
  class_name: string | null;
  program_type: string | null;
  study_plan_name: string | null;
  display_class_name: string;
  schedules: ScheduleInfo[];
}

/**
 * Interface for teacher class feed response
 */
export interface TeacherClassFeedResponse {
  section_id: number;
  section_name: string;
  subject_code: string;
  subject_name_th: string;
  subject_name_en: string;
  learning_area_name: string | null;
  semester: string;
  position: string | null;
  display_class_name: string;
  schedules: ScheduleInfo[];
}
