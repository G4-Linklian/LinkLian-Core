// section.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Section } from './entities/section.entity';
import { SectionSchedule } from './entities/section-schedule.entity';
import { SectionEducator } from './entities/section-educator.entity';
import { Enrollment } from './entities/enrollment.entity';
import {
  SearchSectionMasterDto,
  SearchSectionDto,
  SearchScheduleDto,
  SearchSectionEducatorDto,
  SearchEnrollmentDto,
  CreateSectionDto,
  CreateScheduleDto,
  CreateSectionScheduleDto,
  CreateSectionEducatorDto,
  CreateEnrollmentDto,
  UpdateSectionDto,
  UpdateSectionScheduleDto,
  UpdateSectionEducatorDto,
  UpdateEnrollmentDto,
  DeleteSectionEducatorDto,
  DeleteEnrollmentDto
} from './dto/section.dto';

@Injectable()
export class SectionService {
  constructor(
    @InjectRepository(Section)
    private sectionRepo: Repository<Section>,
    @InjectRepository(SectionSchedule)
    private scheduleRepo: Repository<SectionSchedule>,
    @InjectRepository(SectionEducator)
    private educatorRepo: Repository<SectionEducator>,
    @InjectRepository(Enrollment)
    private enrollmentRepo: Repository<Enrollment>,
    private dataSource: DataSource,
  ) {}

  // ========== Section Master Search ==========

  /**
   * Search sections with optional student count (master view)
   */
  async searchMaster(dto: SearchSectionMasterDto) {
    // Validate input
    const hasInput = dto.section_id || dto.semester_id ||
                     dto.subject_id || dto.inst_id ||
                     typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    // Default count_student to true if not specified
    const countStudent = dto.count_student !== false;

    let query = `
      SELECT 
        s.*, 
        sub.*, 
        sem.*,
        la.learning_area_name
    `;

    // Add student count subquery if requested
    if (countStudent) {
      query += `,
        (
          SELECT COUNT(*)
          FROM enrollment e
          WHERE e.section_id = s.section_id
        ) AS student_count
      `;
    }

    query += `,
      COUNT(*) OVER() AS total_count
      FROM section s
        LEFT JOIN semester sem ON s.semester_id = sem.semester_id
        LEFT JOIN subject sub ON s.subject_id = sub.subject_id
        LEFT JOIN learning_area la ON sub.learning_area_id = la.learning_area_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.section_id) {
      query += ` AND s.section_id = $${index++}`;
      values.push(dto.section_id);
    }

    if (dto.semester_id) {
      query += ` AND s.semester_id = $${index++}`;
      values.push(dto.semester_id);
    }

    if (dto.subject_id) {
      query += ` AND s.subject_id = $${index++}`;
      values.push(dto.subject_id);
    }

    if (dto.section_name) {
      query += ` AND s.section_name = $${index++}`;
      values.push(dto.section_name);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND s.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    if (dto.inst_id) {
      query += ` AND sem.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY s.${dto.sort_by} ${order}`;
    }

    // Pagination
    if (dto.limit) {
      query += ` LIMIT $${index++}`;
      values.push(dto.limit);
    }

    if (dto.offset) {
      query += ` OFFSET $${index++}`;
      values.push(dto.offset);
    }

    try {
      const result = await this.dataSource.query(query, values);
      return { data: result };
    } catch (error) {
      console.error('Error querying sections:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  // ========== Section Search with Schedule ==========

  /**
   * Search sections with schedule and room details
   */
  async search(dto: SearchSectionDto) {
    // Validate input
    const hasInput = dto.section_id || dto.semester_id ||
                     dto.subject_id || dto.schedule_id ||
                     dto.day_of_week || dto.start_time ||
                     dto.end_time || dto.room_location_id ||
                     dto.inst_id || typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    let query = `
      SELECT s.*, 
        sch.schedule_id, sch.day_of_week, sch.start_time, sch.end_time, 
        sub.*, 
        sem.*,
        la.learning_area_name,
        rl.floor, rl.room_number, rl.room_location_id, 
        b.building_id, b.building_name, b.building_no, b.room_format,
        COUNT(*) OVER() AS total_count
      FROM section s
      LEFT JOIN section_schedule sch ON s.section_id = sch.section_id
      LEFT JOIN semester sem ON s.semester_id = sem.semester_id
      LEFT JOIN subject sub ON s.subject_id = sub.subject_id
      LEFT JOIN learning_area la ON sub.learning_area_id = la.learning_area_id
      LEFT JOIN room_location rl ON sch.room_location_id = rl.room_location_id
      LEFT JOIN building b ON rl.building_id = b.building_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.section_id) {
      query += ` AND s.section_id = $${index++}`;
      values.push(dto.section_id);
    }

    if (dto.semester_id) {
      query += ` AND s.semester_id = $${index++}`;
      values.push(dto.semester_id);
    }

    if (dto.subject_id) {
      query += ` AND s.subject_id = $${index++}`;
      values.push(dto.subject_id);
    }

    if (dto.schedule_id) {
      query += ` AND sch.schedule_id = $${index++}`;
      values.push(dto.schedule_id);
    }

    if (dto.day_of_week) {
      query += ` AND sch.day_of_week = $${index++}`;
      values.push(dto.day_of_week);
    }

    if (dto.start_time) {
      query += ` AND sch.start_time = $${index++}`;
      values.push(dto.start_time);
    }

    if (dto.end_time) {
      query += ` AND sch.end_time = $${index++}`;
      values.push(dto.end_time);
    }

    if (dto.room_location_id) {
      query += ` AND sch.room_location_id = $${index++}`;
      values.push(dto.room_location_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND s.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    if (dto.inst_id) {
      query += ` AND sem.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY s.${dto.sort_by} ${order}`;
    }

    // Pagination
    if (dto.limit) {
      query += ` LIMIT $${index++}`;
      values.push(dto.limit);
    }

    if (dto.offset) {
      query += ` OFFSET $${index++}`;
      values.push(dto.offset);
    }

    try {
      const result = await this.dataSource.query(query, values);
      return { data: result };
    } catch (error) {
      console.error('Error querying sections:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  // ========== Schedule Search ==========

  /**
   * Search schedules with room and building info
   */
  async searchSchedule(dto: SearchScheduleDto) {
    // Validate input
    const hasInput = dto.schedule_id || dto.section_id ||
                     dto.day_of_week || dto.start_time ||
                     dto.end_time || dto.room_location_id ||
                     typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    let query = `
      SELECT * FROM section_schedule sch
      LEFT JOIN room_location rl ON sch.room_location_id = rl.room_location_id
      LEFT JOIN building b ON rl.building_id = b.building_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.schedule_id) {
      query += ` AND sch.schedule_id = $${index++}`;
      values.push(dto.schedule_id);
    }

    if (dto.section_id) {
      query += ` AND sch.section_id = $${index++}`;
      values.push(dto.section_id);
    }

    if (dto.day_of_week) {
      query += ` AND sch.day_of_week = $${index++}`;
      values.push(dto.day_of_week);
    }

    if (dto.start_time) {
      query += ` AND sch.start_time = $${index++}`;
      values.push(dto.start_time);
    }

    if (dto.end_time) {
      query += ` AND sch.end_time = $${index++}`;
      values.push(dto.end_time);
    }

    if (dto.room_location_id) {
      query += ` AND sch.room_location_id = $${index++}`;
      values.push(dto.room_location_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND sch.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    try {
      const result = await this.dataSource.query(query, values);
      return { data: result };
    } catch (error) {
      console.error('Error querying schedules:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  // ========== Section Educator Search ==========

  /**
   * Search section educators with optional profile and building info
   */
  async searchEducator(dto: SearchSectionEducatorDto) {
    // Validate input
    const hasInput = dto.section_id || dto.semester_id ||
                     dto.subject_id || dto.user_sys_id ||
                     dto.role_id || dto.role_name ||
                     dto.role_type || typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    const joinBuilding = dto.join_building === true;
    const fromProfile = dto.from_profile === true;

    let query = '';

    if (fromProfile) {
      query += `
        SELECT 
          se.*,
          s.section_name,
          sub.subject_code,
          sub.name_th AS subject_name,
          sub.credit,
          sub.hour_per_week,
          us.user_sys_id,
          us.first_name,
          us.last_name,
          r.role_name,
          r.role_type,
          el.level_name || '/' || cls.program_name AS class_name
      `;

      if (joinBuilding) {
        query += `,
          sch.day_of_week,
          TO_CHAR(sch.start_time, 'HH24:MI') AS start_time,
          TO_CHAR(sch.end_time, 'HH24:MI') AS end_time,
          rm.room_number AS room,
          b.building_name AS building
        `;
      }

      query += `
        FROM section_educator se
      `;
    } else {
      query += `SELECT * FROM section_educator se `;
    }

    query += `
      LEFT JOIN section s ON s.section_id = se.section_id
      LEFT JOIN subject sub ON s.subject_id = sub.subject_id
      LEFT JOIN user_sys us ON se.educator_id = us.user_sys_id
      LEFT JOIN role r ON us.role_id = r.role_id
    `;

    if (fromProfile) {
      query += `
        LEFT JOIN enrollment en ON en.section_id = s.section_id
        LEFT JOIN user_sys stu ON stu.user_sys_id = en.student_id
        LEFT JOIN edu_level el ON el.edu_lev_id = stu.edu_lev_id
        LEFT JOIN user_sys_program_normalize uspn ON uspn.user_sys_id = stu.user_sys_id AND uspn.flag_valid = true
        LEFT JOIN program cls ON cls.program_id = uspn.program_id AND cls.program_type = 'class'
      `;
    }

    if (joinBuilding) {
      query += `
        LEFT JOIN semester sem ON s.semester_id = sem.semester_id
        LEFT JOIN section_schedule sch ON s.section_id = sch.section_id
        LEFT JOIN room_location rm ON sch.room_location_id = rm.room_location_id
        LEFT JOIN building b ON rm.building_id = b.building_id
      `;
    }

    query += ` WHERE 1=1 `;

    const values: any[] = [];
    let index = 1;

    if (dto.section_id) {
      query += ` AND s.section_id = $${index++}`;
      values.push(dto.section_id);
    }

    if (dto.semester_id) {
      query += ` AND s.semester_id = $${index++}`;
      values.push(dto.semester_id);
    }

    if (dto.subject_id) {
      query += ` AND s.subject_id = $${index++}`;
      values.push(dto.subject_id);
    }

    if (dto.user_sys_id) {
      query += ` AND us.user_sys_id = $${index++}`;
      values.push(dto.user_sys_id);
    }

    if (dto.role_id) {
      query += ` AND r.role_id = $${index++}`;
      values.push(dto.role_id);
    }

    if (dto.role_name) {
      query += ` AND r.role_name = $${index++}`;
      values.push(dto.role_name);
    }

    if (dto.role_type) {
      query += ` AND r.role_type = $${index++}`;
      values.push(dto.role_type);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND s.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY se.${dto.sort_by} ${order}`;
    }

    // Pagination
    if (dto.limit) {
      query += ` LIMIT $${index++}`;
      values.push(dto.limit);
    }

    if (dto.offset) {
      query += ` OFFSET $${index++}`;
      values.push(dto.offset);
    }

    try {
      const result = await this.dataSource.query(query, values);
      return { data: result };
    } catch (error) {
      console.error('Error querying section educators:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  // ========== Enrollment Search ==========

  /**
   * Search enrollments with student info
   */
  async searchEnrollment(dto: SearchEnrollmentDto) {
    // Validate input
    const hasInput = dto.section_id || dto.semester_id ||
                     dto.subject_id || dto.user_sys_id ||
                     dto.role_id || dto.role_name ||
                     dto.role_type || typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    let query = `
      SELECT *, COUNT(*) OVER() as total_count 
      FROM enrollment en
      LEFT JOIN section s ON s.section_id = en.section_id AND en.section_id IS NOT NULL
      LEFT JOIN user_sys us ON en.student_id = us.user_sys_id
      LEFT JOIN role r ON us.role_id = r.role_id
      LEFT JOIN edu_level el ON us.edu_lev_id = el.edu_lev_id
      LEFT JOIN user_sys_program_normalize uspn ON us.user_sys_id = uspn.user_sys_id
      LEFT JOIN program p ON uspn.program_id = p.program_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.section_id) {
      query += ` AND s.section_id = $${index++}`;
      values.push(dto.section_id);
    }

    if (dto.semester_id) {
      query += ` AND s.semester_id = $${index++}`;
      values.push(dto.semester_id);
    }

    if (dto.subject_id) {
      query += ` AND s.subject_id = $${index++}`;
      values.push(dto.subject_id);
    }

    if (dto.user_sys_id) {
      query += ` AND us.user_sys_id = $${index++}`;
      values.push(dto.user_sys_id);
    }

    if (dto.role_id) {
      query += ` AND r.role_id = $${index++}`;
      values.push(dto.role_id);
    }

    if (dto.role_name) {
      query += ` AND r.role_name = $${index++}`;
      values.push(dto.role_name);
    }

    if (dto.role_type) {
      query += ` AND r.role_type = $${index++}`;
      values.push(dto.role_type);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND s.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY us.${dto.sort_by} ${order}`;
    }

    // Pagination
    if (dto.limit) {
      query += ` LIMIT $${index++}`;
      values.push(dto.limit);
    }

    if (dto.offset) {
      query += ` OFFSET $${index++}`;
      values.push(dto.offset);
    }

    try {
      const result = await this.dataSource.query(query, values);
      return { data: result };
    } catch (error) {
      console.error('Error querying enrollments:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  // ========== Create Methods ==========

  /**
   * Create a new section
   */
  async createSection(dto: CreateSectionDto) {
    if (!dto.subject_id || !dto.semester_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newSection = this.sectionRepo.create({
        subject_id: dto.subject_id,
        semester_id: dto.semester_id,
        section_name: dto.section_name || null,
        flag_valid: true,
      });

      const savedSection = await this.sectionRepo.save(newSection);
      return { message: 'Section created successfully!', data: savedSection };

    } catch (error) {
      console.error('Error creating section:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Create a new schedule
   */
  async createSchedule(dto: CreateScheduleDto) {
    if (!dto.section_id || !dto.day_of_week || !dto.start_time || !dto.end_time || !dto.room_location_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newSchedule = this.scheduleRepo.create({
        section_id: dto.section_id,
        day_of_week: dto.day_of_week,
        start_time: dto.start_time,
        end_time: dto.end_time,
        room_location_id: dto.room_location_id,
        flag_valid: true,
      });

      const savedSchedule = await this.scheduleRepo.save(newSchedule);
      return { message: 'Schedule created successfully!', data: savedSchedule };

    } catch (error) {
      console.error('Error creating schedule:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Create section with schedule together using transaction
   */
  async createSectionSchedule(dto: CreateSectionScheduleDto) {
    if (!dto.subject_id || !dto.semester_id) {
      throw new BadRequestException('Missing required fields!');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Insert section
      const sectionResult = await queryRunner.query(
        `INSERT INTO section (subject_id, semester_id, section_name, flag_valid, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
        [dto.subject_id, dto.semester_id, dto.section_name || null, true]
      );

      const section = sectionResult[0];

      // Insert schedule if schedule data is provided
      let schedule = null;
      if (dto.day_of_week && dto.start_time && dto.end_time && dto.room_location_id) {
        const scheduleResult = await queryRunner.query(
          `INSERT INTO section_schedule (section_id, day_of_week, start_time, end_time, room_location_id, flag_valid)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [section.section_id, dto.day_of_week, dto.start_time, dto.end_time, dto.room_location_id, true]
        );
        schedule = scheduleResult[0];
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Section and schedule created successfully!',
        data: { section, schedule }
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error creating section schedule:', error);
      throw new InternalServerErrorException('Server Error');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create section educator
   */
  async createEducator(dto: CreateSectionEducatorDto) {
    if (!dto.section_id || !dto.user_sys_id || !dto.position) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newEducator = this.educatorRepo.create({
        section_id: dto.section_id,
        educator_id: dto.user_sys_id,
        position: dto.position,
        flag_valid: true,
      });

      const savedEducator = await this.educatorRepo.save(newEducator);
      return { message: 'Section educator created successfully!', data: savedEducator };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This educator is already added to this section');
      }
      console.error('Error creating section educator:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Create enrollment
   */
  async createEnrollment(dto: CreateEnrollmentDto) {
    if (!dto.section_id || !dto.user_sys_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const query = `INSERT INTO enrollment (section_id, student_id, flag_valid, enrolled_at) 
                     VALUES ($1, $2, $3, NOW()) RETURNING *`;
      const result = await this.dataSource.query(query, [dto.section_id, dto.user_sys_id, true]);

      return { message: 'Enrollment created successfully!', data: result[0] };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This student is already enrolled in this section');
      }
      console.error('Error creating enrollment:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  // ========== Update Methods ==========

  /**
   * Update section
   */
  async updateSection(id: number, dto: UpdateSectionDto) {
    // Check if section exists
    const existing = await this.sectionRepo.findOne({ where: { section_id: id } });
    if (!existing) {
      throw new NotFoundException('Section not found!');
    }

    const updates: Partial<Section> = {};

    if (dto.subject_id !== undefined) updates.subject_id = dto.subject_id;
    if (dto.semester_id !== undefined) updates.semester_id = dto.semester_id;
    if (dto.section_name !== undefined) updates.section_name = dto.section_name;
    if (typeof dto.flag_valid === 'boolean') updates.flag_valid = dto.flag_valid;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.sectionRepo.update({ section_id: id }, updates);
      const updated = await this.sectionRepo.findOne({ where: { section_id: id } });
      return { message: 'Section updated successfully!', data: updated };

    } catch (error) {
      console.error('Error updating section:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Update section and schedule together
   */
  async updateSectionSchedule(dto: UpdateSectionScheduleDto) {
    if (!dto.section_id) {
      throw new BadRequestException('Missing section_id for update!');
    }

    const sectionColumns = ['subject_id', 'semester_id', 'section_name'];
    const scheduleColumns = ['day_of_week', 'start_time', 'end_time', 'room_location_id'];

    let updatedSection = null;
    let updatedSchedule = null;

    try {
      // Update section if any section field is provided
      const sectionUpdates: string[] = [];
      const sectionValues: any[] = [];
      let sectionIndex = 1;

      for (const col of sectionColumns) {
        if (dto[col] !== undefined) {
          sectionUpdates.push(`${col} = $${sectionIndex++}`);
          sectionValues.push(dto[col]);
        }
      }

      if (sectionUpdates.length > 0) {
        sectionUpdates.push(`updated_at = NOW()`);
        sectionValues.push(dto.section_id);
        const sectionQuery = `UPDATE section SET ${sectionUpdates.join(', ')} WHERE section_id = $${sectionIndex} RETURNING *`;
        const result = await this.dataSource.query(sectionQuery, sectionValues);
        updatedSection = result[0];
      }

      // Update schedule if schedule_id is provided and any schedule field is provided
      if (dto.schedule_id) {
        const scheduleUpdates: string[] = [];
        const scheduleValues: any[] = [];
        let scheduleIndex = 1;

        for (const col of scheduleColumns) {
          if (dto[col] !== undefined) {
            scheduleUpdates.push(`${col} = $${scheduleIndex++}`);
            scheduleValues.push(dto[col]);
          }
        }

        if (scheduleUpdates.length > 0) {
          scheduleValues.push(dto.schedule_id);
          const scheduleQuery = `UPDATE section_schedule SET ${scheduleUpdates.join(', ')} WHERE schedule_id = $${scheduleIndex} RETURNING *`;
          const result = await this.dataSource.query(scheduleQuery, scheduleValues);
          updatedSchedule = result[0];
        }
      }

      if (!updatedSection && !updatedSchedule) {
        return { message: 'No fields provided for update, nothing changed.', data: null };
      }

      return {
        message: 'Section schedule updated successfully!',
        data: {
          section: updatedSection || 'No changes',
          schedule: updatedSchedule || 'No changes',
        }
      };

    } catch (error) {
      console.error('Error updating section schedule:', error);
      throw new InternalServerErrorException('Server Error during update');
    }
  }

  /**
   * Update section educator
   */
  async updateEducator(dto: UpdateSectionEducatorDto) {
    if (!dto.section_id && !dto.user_sys_id) {
      throw new BadRequestException('At least one of section_id or user_sys_id is required!');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.section_id !== undefined) {
      updates.push(`section_id = $${index++}`);
      values.push(dto.section_id);
    }

    if (dto.user_sys_id !== undefined) {
      updates.push(`educator_id = $${index++}`);
      values.push(dto.user_sys_id);
    }

    if (dto.position !== undefined) {
      updates.push(`position = $${index++}`);
      values.push(dto.position);
    }

    if (typeof dto.flag_valid === 'boolean') {
      updates.push(`flag_valid = $${index++}`);
      values.push(dto.flag_valid);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    if (dto.section_id) {
      whereClause += ` AND section_id = $${index++}`;
      values.push(dto.section_id);
    }
    if (dto.user_sys_id) {
      whereClause += ` AND educator_id = $${index++}`;
      values.push(dto.user_sys_id);
    }

    try {
      const query = `UPDATE section_educator SET ${updates.join(', ')} ${whereClause} RETURNING *`;
      const result = await this.dataSource.query(query, values);

      if (result.length === 0) {
        throw new NotFoundException('Section educator not found!');
      }

      return { message: 'Section educator updated successfully!', data: result };

    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      if (error.code === '23505') {
        throw new ConflictException('Educator is already added to this section');
      }
      console.error('Error updating section educator:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Update enrollment
   */
  async updateEnrollment(dto: UpdateEnrollmentDto) {
    if (!dto.section_id && !dto.user_sys_id) {
      throw new BadRequestException('At least one of section_id or user_sys_id is required!');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.section_id !== undefined) {
      updates.push(`section_id = $${index++}`);
      values.push(dto.section_id);
    }

    if (dto.user_sys_id !== undefined) {
      updates.push(`student_id = $${index++}`);
      values.push(dto.user_sys_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      updates.push(`flag_valid = $${index++}`);
      values.push(dto.flag_valid);
    }

    if (updates.length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';
    if (dto.section_id) {
      whereClause += ` AND section_id = $${index++}`;
      values.push(dto.section_id);
    }
    if (dto.user_sys_id) {
      whereClause += ` AND student_id = $${index++}`;
      values.push(dto.user_sys_id);
    }

    try {
      const query = `UPDATE enrollment SET ${updates.join(', ')} ${whereClause} RETURNING *`;
      const result = await this.dataSource.query(query, values);

      if (result.length === 0) {
        throw new NotFoundException('Enrollment not found!');
      }

      return { message: 'Enrollment updated successfully!', data: result };

    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      if (error.code === '23505') {
        throw new ConflictException('Student is already enrolled in this section');
      }
      console.error('Error updating enrollment:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  // ========== Delete Methods ==========

  /**
   * Delete section
   */
  async deleteSection(id: number) {
    try {
      const query = `DELETE FROM section WHERE section_id = $1 RETURNING *`;
      const result = await this.dataSource.query(query, [id]);

      if (result.length === 0) {
        throw new NotFoundException('Section not found!');
      }

      return { message: 'Section deleted successfully!', data: result[0] };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error deleting section:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(id: number) {
    try {
      const query = `DELETE FROM section_schedule WHERE schedule_id = $1 RETURNING *`;
      const result = await this.dataSource.query(query, [id]);

      if (result.length === 0) {
        throw new NotFoundException('Schedule not found!');
      }

      return { message: 'Schedule deleted successfully!', data: result[0] };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error deleting schedule:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Delete section educator
   */
  async deleteEducator(dto: DeleteSectionEducatorDto) {
    if (!dto.section_id && !dto.user_sys_id) {
      throw new BadRequestException('At least one of section_id or user_sys_id is required!');
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.section_id) {
      conditions.push(`section_id = $${index++}`);
      values.push(dto.section_id);
    }

    if (dto.user_sys_id) {
      conditions.push(`educator_id = $${index++}`);
      values.push(dto.user_sys_id);
    }

    try {
      const query = `DELETE FROM section_educator WHERE ${conditions.join(' AND ')} RETURNING *`;
      const result = await this.dataSource.query(query, values);

      if (result.length === 0) {
        throw new NotFoundException('No matching records found!');
      }

      return { message: 'Section educator deleted successfully!', data: result };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error deleting section educator:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Delete enrollment
   */
  async deleteEnrollment(dto: DeleteEnrollmentDto) {
    if (!dto.section_id && !dto.user_sys_id) {
      throw new BadRequestException('At least one of section_id or user_sys_id is required!');
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.section_id) {
      conditions.push(`section_id = $${index++}`);
      values.push(dto.section_id);
    }

    if (dto.user_sys_id) {
      conditions.push(`student_id = $${index++}`);
      values.push(dto.user_sys_id);
    }

    try {
      const query = `DELETE FROM enrollment WHERE ${conditions.join(' AND ')} RETURNING *`;
      const result = await this.dataSource.query(query, values);

      if (result.length === 0) {
        throw new NotFoundException('No matching records found!');
      }

      return { message: 'Enrollment deleted successfully!', data: result };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error deleting enrollment:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }
}
