// feed.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  GetClassFeedDto,
  StudentClassFeedResponse,
  TeacherClassFeedResponse,
} from './dto/feed.dto';

@Injectable()
export class FeedService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get student class feed with schedules
   * Returns all enrolled classes for a student in a semester
   */
  async getStudentClassFeed(
    dto: GetClassFeedDto,
  ): Promise<StudentClassFeedResponse> {
    const query = `
      SELECT
        s.section_id,
        s.section_name,
        sub.subject_code,
        sub.name_th AS subject_name_th,
        sub.name_en AS subject_name_en,
        la.learning_area_name,
        sem.semester,
        (
          SELECT COUNT(*)::int
          FROM enrollment e
          WHERE e.section_id = s.section_id
            AND e.flag_valid = true
        ) AS student_count,
        
        -- ใช้ section_name โดยตรง ไม่ต้อง join edu_level
        s.section_name AS display_class_name,

        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'day_of_week', sch.day_of_week,
                'start_time', sch.start_time,
                'end_time', sch.end_time,
                'room', jsonb_build_object(
                  'room_location_id', COALESCE(rl.room_location_id::integer, 0),
                  'room_number', COALESCE(rl.room_number::text, ''),
                  'floor', COALESCE(rl.floor::integer, 0),
                  'room_remark', COALESCE(rl.room_remark::text, '')
                ),
                'building', jsonb_build_object(
                  'building_id', COALESCE(b.building_id::integer, 0),
                  'building_name', COALESCE(b.building_name::text, ''),
                  'building_no', COALESCE(b.building_no::text, ''),
                  'room_format', COALESCE(b.room_format::text, '')
                )
              )
              ORDER BY sch.day_of_week ASC, sch.start_time ASC
            )
            FROM section_schedule sch
            LEFT JOIN room_location rl
              ON sch.room_location_id = rl.room_location_id
             AND rl.flag_valid = true
            LEFT JOIN building b
              ON rl.building_id = b.building_id
             AND b.flag_valid = true
            WHERE sch.section_id = s.section_id
              AND sch.flag_valid = true
              AND sch.day_of_week IS NOT NULL
          ),
          '[]'::json
        ) AS schedules

      FROM enrollment en
      JOIN section s
        ON en.section_id = s.section_id
       AND s.flag_valid = true

      JOIN subject sub
        ON s.subject_id = sub.subject_id

      LEFT JOIN learning_area la
        ON sub.learning_area_id = la.learning_area_id

      JOIN semester sem
        ON s.semester_id = sem.semester_id
       AND sem.status IN ('open', 'close')

      WHERE
        en.student_id = $1
        AND s.semester_id = $2
        AND en.flag_valid = true

      GROUP BY
        s.section_id,
        s.section_name,
        sub.subject_code,
        sub.name_th,
        sub.name_en,
        la.learning_area_name,
        sem.semester

      ORDER BY s.section_name
      LIMIT $3 OFFSET $4
    `;

    try {
      const result_feed = await this.dataSource.query(query, [
        dto.user_id,
        dto.semester_id,
        dto.limit || 10,
        dto.offset || 0,
      ]);
      return {
        success: true,
        message: 'Student class feed retrieved successfully',
        data: result_feed,
      };
    } catch (error) {
      console.error('Error fetching student class feed:', error);
      throw new InternalServerErrorException('Error fetching class feed');
    }
  }

  /**
   * Get teacher class feed with schedules
   * Returns all sections assigned to a teacher/educator in a semester
   */
  async getTeacherClassFeed(
    dto: GetClassFeedDto,
  ): Promise<TeacherClassFeedResponse> {
    const query = `
      SELECT
        s.section_id,
        s.section_name,
        sub.subject_code,
        sub.name_th AS subject_name_th,
        sub.name_en AS subject_name_en,
        la.learning_area_name,
        sem.semester,
        se.position,
        (
          SELECT COUNT(*)::int
          FROM enrollment e
          WHERE e.section_id = s.section_id
            AND e.flag_valid = true
        ) AS student_count,

        -- ใช้ section_name โดยตรง ไม่ต้อง join edu_level
        s.section_name AS display_class_name,

        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'day_of_week', sch.day_of_week,
                'start_time', sch.start_time,
                'end_time', sch.end_time,
                'room', jsonb_build_object(
                  'room_location_id', COALESCE(rl.room_location_id::integer, 0),
                  'room_number', COALESCE(rl.room_number::text, ''),
                  'floor', COALESCE(rl.floor::integer, 0),
                  'room_remark', COALESCE(rl.room_remark::text, '')
                ),
                'building', jsonb_build_object(
                  'building_id', COALESCE(b.building_id::integer, 0),
                  'building_name', COALESCE(b.building_name::text, ''),
                  'building_no', COALESCE(b.building_no::text, ''),
                  'room_format', COALESCE(b.room_format::text, '')
                )
              )
              ORDER BY sch.day_of_week ASC, sch.start_time ASC
            )
            FROM section_schedule sch
            LEFT JOIN room_location rl
              ON sch.room_location_id = rl.room_location_id
             AND rl.flag_valid = true
            LEFT JOIN building b
              ON rl.building_id = b.building_id
             AND b.flag_valid = true
            WHERE sch.section_id = s.section_id
              AND sch.flag_valid = true
              AND sch.day_of_week IS NOT NULL
          ),
          '[]'::json
        ) AS schedules

      FROM section_educator se
      JOIN section s
        ON se.section_id = s.section_id
       AND s.flag_valid = true

      JOIN subject sub
        ON s.subject_id = sub.subject_id

      LEFT JOIN learning_area la
        ON sub.learning_area_id = la.learning_area_id

      JOIN semester sem
        ON s.semester_id = sem.semester_id
       AND sem.status IN ('open', 'close')

      WHERE
        se.educator_id = $1
        AND s.semester_id = $2
        AND se.flag_valid = true

      GROUP BY
        s.section_id,
        s.section_name,
        sub.subject_code,
        sub.name_th,
        sub.name_en,
        la.learning_area_name,
        sem.semester,
        se.position

      ORDER BY s.section_name
      LIMIT $3 OFFSET $4
    `;

    try {
      const result_feed = await this.dataSource.query(query, [
        dto.user_id,
        dto.semester_id,
        dto.limit || 10,
        dto.offset || 0,
      ]);
      return {
        success: true,
        message: 'Teacher class feed retrieved successfully',
        data: result_feed,
      };
    } catch (error) {
      console.error('Error fetching teacher class feed:', error);
      throw new InternalServerErrorException('Error fetching class feed');
    }
  }
}
