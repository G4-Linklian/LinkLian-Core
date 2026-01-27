// feed.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GetClassFeedDto, StudentClassFeedResponse, TeacherClassFeedResponse } from './dto/feed.dto';

@Injectable()
export class FeedService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get student class feed with schedules
   * Returns all enrolled classes for a student in a semester
   */
  async getStudentClassFeed(dto: GetClassFeedDto): Promise<StudentClassFeedResponse[]> {
    const query = `
      SELECT
        s.section_id,
        s.section_name,
        sub.subject_code,
        sub.name_th AS subject_name_th,
        sub.name_en AS subject_name_en,
        la.learning_area_name,
        sem.semester,
        el.edu_type,
        el.level_num,
        el.level_name,
        p.program_name AS class_name,
        p.program_type,
        parent_prog.program_name AS study_plan_name,

        CASE
          WHEN el.edu_type IN ('basic', 'high school') AND el.level_name IS NOT NULL AND p.program_name IS NOT NULL
          THEN CONCAT(el.level_name, '/', p.program_name)
          
          WHEN el.edu_type IN ('basic', 'high school') AND el.level_name IS NOT NULL
          THEN CASE
            WHEN s.section_name ~ '.+ SEC [0-9]+'
            THEN CONCAT(el.level_name, '/', SUBSTRING(s.section_name FROM 'SEC ([0-9]+)'))
            
            WHEN s.section_name ~ '^S[0-9]+$'
            THEN CONCAT(el.level_name, '/', SUBSTRING(s.section_name FROM 'S([0-9]+)'))
            
            WHEN s.section_name ~ '^SEC [0-9]+$'
            THEN CONCAT(el.level_name, '/', SUBSTRING(s.section_name FROM 'SEC ([0-9]+)'))
            
            WHEN s.section_name ~ '^[0-9]+$'
            THEN CONCAT(el.level_name, '/', s.section_name)
            
            ELSE s.section_name
          END
          
          ELSE s.section_name
        END AS display_class_name,

        COALESCE(
          json_agg(
            jsonb_build_object(
              'day_of_week', sc.day_of_week,
              'start_time', sc.start_time,
              'end_time', sc.end_time,
              'room', jsonb_build_object(
                'room_location_id', sc.room_location_id,
                'room_number', sc.room_number,
                'floor', sc.floor,
                'room_remark', sc.room_remark
              ),
              'building', jsonb_build_object(
                'building_id', sc.building_id,
                'building_name', sc.building_name,
                'building_no', sc.building_no,
                'room_format', sc.room_format
              )
            )
            ORDER BY sc.day_of_week ASC, sc.start_time ASC
          ) FILTER (WHERE sc.day_of_week IS NOT NULL),
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

      JOIN user_sys u
        ON en.student_id = u.user_sys_id
       AND u.flag_valid = true

      LEFT JOIN edu_level el
        ON u.edu_lev_id = el.edu_lev_id
       AND el.flag_valid = true

      LEFT JOIN user_sys_program_normalize uspn
        ON u.user_sys_id = uspn.user_sys_id
       AND uspn.flag_valid = true

      LEFT JOIN program p
        ON uspn.program_id = p.program_id
       AND p.flag_valid = true

      LEFT JOIN program parent_prog
        ON p.parent_id = parent_prog.program_id
       AND parent_prog.flag_valid = true

      LEFT JOIN LATERAL (
        SELECT DISTINCT
          sch.day_of_week,
          sch.start_time,
          sch.end_time,

          rl.room_location_id,
          rl.room_number,
          rl.floor,
          rl.room_remark,

          b.building_id,
          b.building_name,
          b.building_no,
          b.room_format

        FROM section_schedule sch
        LEFT JOIN room_location rl
          ON sch.room_location_id = rl.room_location_id
         AND rl.flag_valid = true

        LEFT JOIN building b
          ON rl.building_id = b.building_id
         AND b.flag_valid = true

        WHERE sch.section_id = s.section_id
          AND sch.flag_valid = true
      ) sc ON true

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
        sem.semester,
        el.edu_type,
        el.level_num,
        el.level_name,
        p.program_name,
        p.program_type,
        parent_prog.program_name

      ORDER BY s.section_name
    `;

    try {
      return await this.dataSource.query(query, [dto.user_id, dto.semester_id]);
    } catch (error) {
      console.error('Error fetching student class feed:', error);
      throw new InternalServerErrorException('Error fetching class feed');
    }
  }

  /**
   * Get teacher class feed with schedules
   * Returns all sections assigned to a teacher/educator in a semester
   */
  async getTeacherClassFeed(dto: GetClassFeedDto): Promise<TeacherClassFeedResponse[]> {
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

        NULL AS edu_type,
        NULL AS level_num,
        NULL AS level_name,
        NULL AS class_name,
        NULL AS program_type,
        NULL AS study_plan_name,
        s.section_name AS display_class_name,

        COALESCE(
          json_agg(
            jsonb_build_object(
              'day_of_week', sc.day_of_week,
              'start_time', sc.start_time,
              'end_time', sc.end_time,
              'room', jsonb_build_object(
                'room_location_id', sc.room_location_id,
                'room_number', sc.room_number,
                'floor', sc.floor,
                'room_remark', sc.room_remark
              ),
              'building', jsonb_build_object(
                'building_id', sc.building_id,
                'building_name', sc.building_name,
                'building_no', sc.building_no,
                'room_format', sc.room_format
              )
            )
            ORDER BY sc.day_of_week ASC, sc.start_time ASC
          ) FILTER (WHERE sc.day_of_week IS NOT NULL),
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

      LEFT JOIN LATERAL (
        SELECT DISTINCT
          sch.day_of_week,
          sch.start_time,
          sch.end_time,

          rl.room_location_id,
          rl.room_number,
          rl.floor,
          rl.room_remark,

          b.building_id,
          b.building_name,
          b.building_no,
          b.room_format

        FROM section_schedule sch
        LEFT JOIN room_location rl
          ON sch.room_location_id = rl.room_location_id
         AND rl.flag_valid = true

        LEFT JOIN building b
          ON rl.building_id = b.building_id
         AND b.flag_valid = true

        WHERE sch.section_id = s.section_id
          AND sch.flag_valid = true
      ) sc ON true

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
    `;

    try {
      return await this.dataSource.query(query, [dto.user_id, dto.semester_id]);
    } catch (error) {
      console.error('Error fetching teacher class feed:', error);
      throw new InternalServerErrorException('Error fetching class feed');
    }
  }
}
