// filepath: /Users/thunyatorn/Desktop/LinkLian-Core/src/modules/social-feed/class-info/class-info.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ClassInfoService {
  constructor(private dataSource: DataSource) { }

  /**
   * Get section educators with user info
   * Returns only main teachers (position = 'main_teacher')
   */
  async getSectionEducators(sectionId: number) {
    const query = `
      SELECT 
        se.educator_id,
        se.position,
        u.user_sys_id,
        CONCAT(u.first_name, ' ', u.last_name) as display_name,
        u.email,
        u.profile_pic
      FROM section_educator se
      JOIN user_sys u ON se.educator_id = u.user_sys_id
      WHERE se.section_id = $1
        AND se.flag_valid = true
        AND se.position = 'main_teacher'
      ORDER BY u.first_name ASC
      LIMIT 1
    `;

    try {
      const result = await this.dataSource.query(query, [sectionId]);
      return result;
    } catch (error) {
      console.error('Error fetching section educators:', error);
      throw new InternalServerErrorException('Error fetching section educators');
    }
  }

  /**
   * Get class info: room location, schedules, members, educators
   */
  async getClassInfo(sectionId: number) {
    try {
      // 1. Get room location from schedules
      const roomQuery = `
        SELECT DISTINCT
          b.building_name,
          b.building_no,
          rl.room_number,
          rl.floor
        FROM section_schedule ss
        LEFT JOIN room_location rl ON ss.room_location_id = rl.room_location_id
        LEFT JOIN building b ON rl.building_id = b.building_id
        WHERE ss.section_id = $1
          AND ss.flag_valid = true
        LIMIT 1
      `;
      const roomResult = await this.dataSource.query(roomQuery, [sectionId]);

      let roomLocation = '';
      if (roomResult.length > 0) {
        const room = roomResult[0];
        const parts: string[] = [];
        if (room.building_name) parts.push(room.building_name);
        if (room.room_number) parts.push(`ห้อง ${room.room_number}`);
        if (room.floor) parts.push(`ชั้น ${room.floor}`);
        roomLocation = parts.join(' ');
      }

      // 2. Get schedules
      const schedulesQuery = `
        SELECT 
          ss.day_of_week,
          ss.start_time,
          ss.end_time,
          jsonb_build_object(
            'room_location_id', rl.room_location_id,
            'room_number', rl.room_number,
            'floor', rl.floor,
            'room_remark', rl.room_remark
          ) as room,
          jsonb_build_object(
            'building_id', b.building_id,
            'building_name', b.building_name,
            'building_no', b.building_no
          ) as building
        FROM section_schedule ss
        LEFT JOIN room_location rl ON ss.room_location_id = rl.room_location_id
        LEFT JOIN building b ON rl.building_id = b.building_id
        WHERE ss.section_id = $1
          AND ss.flag_valid = true
        ORDER BY ss.day_of_week ASC, ss.start_time ASC
      `;
      const schedules = await this.dataSource.query(schedulesQuery, [sectionId]);

      // 3. Get members (enrolled students)
      const membersQuery = `
        SELECT 
          e.student_id,
          u.user_sys_id,
          u.code as student_code,
          CONCAT(u.first_name, ' ', u.last_name) as display_name,
          u.profile_pic
        FROM enrollment e
        JOIN user_sys u ON e.student_id = u.user_sys_id
        WHERE e.section_id = $1
          AND e.flag_valid = true
        ORDER BY u.first_name ASC
      `;
      const members = await this.dataSource.query(membersQuery, [sectionId]);

      // 4. Get educators (all educators, but mark main teacher)
      const educatorsQuery = `
        SELECT 
          se.educator_id,
          se.position,
          u.user_sys_id,
          CONCAT(u.first_name, ' ', u.last_name) as display_name,
          u.profile_pic,
          (se.position = 'main_teacher') as is_main_teacher
        FROM section_educator se
        JOIN user_sys u ON se.educator_id = u.user_sys_id
        WHERE se.section_id = $1
          AND se.flag_valid = true
        ORDER BY is_main_teacher DESC, u.first_name ASC
      `;
      const educators = await this.dataSource.query(educatorsQuery, [sectionId]);
      console.log(`[GetClassInfo] Educators query returned ${educators.length} educators`);
      const final_result = { room_location: roomLocation, schedules, members, educators };
      return {
        success: true,
        message: 'Class info fetched successfully',
        data: final_result
      };
    } catch (error) {
      console.error('Error fetching class info:', error);
      throw new InternalServerErrorException('Error fetching class info');
    }
  }
}
