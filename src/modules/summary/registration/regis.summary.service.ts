// regis.summary.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  RegisSummaryInfoDto,
  RegisSummaryCurriculumDto,
  RegisSummaryScheduleDto,
  RegisSummaryRegistrationDto,
} from './dto/regis.summary.dto';
import { regisSummaryFields } from './interface/regis.summary.interface';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class RegisSummaryService {
  constructor(
    private dataSource: DataSource,
    private logger: AppLogger,
  ) {}

  /**
   * Get general registration information summary
   */
  async getInfo(dto: RegisSummaryInfoDto) {
    if (!dto.inst_id) {
      throw new BadRequestException('Institution ID is required');
    }

    try {
      const query = `
        SELECT
          (SELECT COUNT(s.semester_id)
           FROM semester s
           WHERE s.inst_id = $1) AS "academicYear",

          (SELECT COUNT(us.user_sys_id)
           FROM user_sys us
           WHERE us.role_id IN (4, 5)
           AND us.inst_id = $1) AS staff,

          (SELECT COUNT(b.building_id)
           FROM building b
           WHERE b.inst_id = $1) AS building,

          (SELECT COUNT(rl.room_location_id)
           FROM room_location rl
           LEFT JOIN building b2 ON b2.building_id = rl.building_id
           WHERE b2.inst_id = $1) AS classroom
      `;

      const result: regisSummaryFields[] = await this.dataSource.query(query, [
        dto.inst_id,
      ]);

      return { success: true, data: result[0] || {} };
    } catch (error: unknown) {
      this.logger.error(
        'Error fetching registration info:',
        'SummaryGetInfo',
        error,
      );
      throw new InternalServerErrorException(
        'Error fetching registration info',
      );
    }
  }

  /**
   * Get curriculum-based registration summary
   */
  async getCurriculum(dto: RegisSummaryCurriculumDto) {
    if (!dto.inst_id) {
      throw new BadRequestException('Institution ID is required');
    }

    try {
      const query = `
        SELECT
          (SELECT COUNT(la.learning_area_id)
           FROM learning_area la
           WHERE la.inst_id = $1) AS "learningArea",

          (SELECT COUNT(s.subject_id)
           FROM subject s
           LEFT JOIN learning_area la ON la.learning_area_id = s.learning_area_id
           WHERE la.inst_id = $1) AS subject,

          (SELECT COUNT(p.program_id)
           FROM program p
           WHERE p.tree_type = 'root'
             AND p.inst_id = $1) AS curriculum
      `;

      const result: regisSummaryFields[] = await this.dataSource.query(query, [
        dto.inst_id,
      ]);

      return { success: true, data: result[0] || {} };
    } catch (error: unknown) {
      this.logger.error(
        'Error fetching curriculum registration:',
        'SummaryGetCurriculum',
        error,
      );
      throw new InternalServerErrorException(
        'Error fetching curriculum registration',
      );
    }
  }

  /**
   * Get schedule-based registration summary
   */
  async getSchedule(dto: RegisSummaryScheduleDto) {
    if (!dto.inst_id) {
      throw new BadRequestException('Institution ID is required');
    }

    if (!dto.semester_id) {
      throw new BadRequestException('Semester ID is required');
    }

    try {
      const query = `
        SELECT
          (SELECT COUNT(p.program_id)
           FROM program p
           WHERE p.tree_type = 'leaf'
             AND p.inst_id = $1) AS classroom,

          (SELECT COUNT(s.section_id)
           FROM section s
           INNER JOIN semester sem
             ON sem.semester_id = s.semester_id
           WHERE sem.inst_id = $1
             AND sem.semester_id = $2) AS "sectionSchedule"
      `;

      const result: regisSummaryFields[] = await this.dataSource.query(query, [
        dto.inst_id,
        dto.semester_id,
      ]);

      return { success: true, data: result[0] || {} };
    } catch (error: unknown) {
      this.logger.error(
        'Error fetching schedule registration:',
        'SummaryGetSchedule',
        error,
      );
      throw new InternalServerErrorException(
        'Error fetching schedule registration',
      );
    }
  }

  /**
   * Get registration status summary
   */
  async getRegistration(dto: RegisSummaryRegistrationDto) {
    if (!dto.inst_id) {
      throw new BadRequestException('Institution ID is required');
    }

    try {
      const query = `
        SELECT
          COUNT(*) AS "allStudent",

          COUNT(CASE
                  WHEN us.user_status = 'Active'
                  THEN 1
                END) AS "activeStudent",

          COUNT(CASE
                  WHEN us.user_status = 'Graduated'
                  THEN 1
                END) AS "graduatedStudent"

        FROM user_sys us
        WHERE us.role_id IN (2, 3)
          AND us.inst_id = $1
      `;

      const result: regisSummaryFields[] = await this.dataSource.query(query, [
        dto.inst_id,
      ]);

      return { success: true, data: result[0] || {} };
    } catch (error: unknown) {
      this.logger.error(
        'Error fetching registration status:',
        'SummaryGetRegistration',
        error,
      );
      throw new InternalServerErrorException(
        'Error fetching registration status',
      );
    }
  }
}
