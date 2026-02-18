// profile.service.ts
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UpdateProfileDto, EducationInfo, ProfileResponse } from './dto/profile.dto';

@Injectable()
export class ProfileService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get user profile with education info based on role and edu_type
   * - High school: level, classroom, study_plan
   * - University: level, classroom, faculty, program (department)
   */
  async getUserProfile(userId: number): Promise<any> {
    // Query basic profile info with role
    const profileQuery = `
      SELECT 
        u.user_sys_id,
        u.code,
        u.email,
        u.first_name,
        u.last_name,
        u.phone,
        u.profile_pic,
        r.role_id,
        r.role_name
      FROM user_sys u
      LEFT JOIN role r ON r.role_id = u.role_id
      WHERE u.user_sys_id = $1
      LIMIT 1
    `;

    try {
      const profileResult = await this.dataSource.query(profileQuery, [userId]);

      if (profileResult.length === 0) {
        throw new NotFoundException('Profile not found');
      }

      const profile = profileResult[0];
      const roleName = profile.role_name;

      // Query education level info
      const eduQuery = `
        SELECT 
          el.edu_type,
          el.level_name
        FROM user_sys u
        LEFT JOIN edu_level el ON el.edu_lev_id = u.edu_lev_id
        WHERE u.user_sys_id = $1
      `;

      const eduResult = await this.dataSource.query(eduQuery, [userId]);
      let education: EducationInfo | null = null;

      if (eduResult.length > 0 && eduResult[0].edu_type) {
        const edu = eduResult[0];
        const eduType = edu.edu_type;
        const levelName = edu.level_name;

        if (eduType === 'high school') {
          // High school education - get class and study plan
          education = await this.getHighSchoolEducation(userId, levelName);
        } else {
          // University education - get faculty, department, major
          education = await this.getUniversityEducation(userId, levelName);
        }
      }

      // Determine role group (teacher or student)
      const isTeacher = roleName === 'teacher' || roleName === 'instructor';
      const roleGroup = isTeacher ? 'teacher' : 'student';

      return {
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          ...profile,
          role_group: roleGroup,
          education,
        },
      };

    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error querying user profile:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  /**
   * Get high school education info (level, classroom, study_plan)
   */
  private async getHighSchoolEducation(userId: number, levelName: string): Promise<EducationInfo> {
    // Query class (program) and study plan
    const classQuery = `
      SELECT
        cls.program_name AS program_name,
        sp.program_name AS study_plan
      FROM user_sys_program_normalize up
      LEFT JOIN program cls ON cls.program_id = up.program_id AND cls.program_type = 'class'
      LEFT JOIN program sp ON sp.program_id = cls.parent_id AND sp.program_type = 'study_plan'
      WHERE up.user_sys_id = $1 AND up.flag_valid = true
      LIMIT 1
    `;

    const classResult = await this.dataSource.query(classQuery, [userId]);
    const programName = classResult[0]?.program_name ?? '-';
    const studyPlan = classResult[0]?.study_plan ?? null;

    const className = `${levelName}/${programName}`;

    return {
      type: 'high_school',
      level: levelName,
      classroom: programName,
      study_plan: studyPlan,
      display: studyPlan ? `${className} ${studyPlan}` : className,
    };
  }

  /**
   * Get university education info (level, classroom, faculty, department)
   */
  private async getUniversityEducation(userId: number, levelName: string): Promise<EducationInfo> {
    // Query class info for program_name (classroom)
    const classQuery = `
      SELECT
        cls.program_name AS program_name
      FROM user_sys_program_normalize up
      LEFT JOIN program cls ON cls.program_id = up.program_id AND cls.program_type = 'class'
      WHERE up.user_sys_id = $1 AND up.flag_valid = true
      LIMIT 1
    `;

    const classResult = await this.dataSource.query(classQuery, [userId]);
    const programName = classResult[0]?.program_name ?? '-';

    // Query section name
    const sectionQuery = `
      SELECT s.section_name
      FROM enrollment e
      LEFT JOIN section s ON s.section_id = e.section_id
      WHERE e.student_id = $1
      ORDER BY s.section_id DESC
      LIMIT 1
    `;

    const sectionResult = await this.dataSource.query(sectionQuery, [userId]);
    const sectionName = sectionResult[0]?.section_name ?? '-';

    // Query university hierarchy (major -> department -> faculty)
    const uniQuery = `
      SELECT 
        major.program_name AS program_name,
        dept.program_name AS department,
        fac.program_name AS faculty
      FROM user_sys_program_normalize up
      JOIN program major ON major.program_id = up.program_id AND major.program_type = 'major'
      LEFT JOIN program dept ON dept.program_id = major.parent_id AND dept.program_type = 'department'
      LEFT JOIN program fac ON fac.program_id = dept.parent_id AND fac.program_type = 'faculty'
      WHERE up.user_sys_id = $1 AND up.flag_valid = true
      LIMIT 1
    `;

    const uniResult = await this.dataSource.query(uniQuery, [userId]);
    const department = uniResult[0]?.department ?? '-';
    const faculty = uniResult[0]?.faculty ?? '-';

    return {
      type: 'university',
      level: levelName,
      classroom: programName,
      faculty: faculty,
      program: department,
      display: `${levelName} ${department} ${sectionName}`,
    };
  }

  /**
   * Update user profile (first_name, middle_name, last_name, phone, profile_pic)
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    // Validate required fields
    if (dto.first_name !== undefined && String(dto.first_name).trim() === '') {
      throw new BadRequestException('First name is required');
    }

    if (dto.last_name !== undefined && String(dto.last_name).trim() === '') {
      throw new BadRequestException('Last name is required');
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.first_name) {
      updateFields.push(`first_name = $${index++}`);
      values.push(dto.first_name);
    }

    if (dto.middle_name !== undefined) {
      updateFields.push(`middle_name = $${index++}`);
      values.push(dto.middle_name);
    }

    if (dto.last_name) {
      updateFields.push(`last_name = $${index++}`);
      values.push(dto.last_name);
    }

    if (dto.phone !== undefined) {
      updateFields.push(`phone = $${index++}`);
      values.push(dto.phone);
    }

    if (dto.profile_pic !== undefined) {
      updateFields.push(`profile_pic = $${index++}`);
      values.push(dto.profile_pic);
    }

    if (updateFields.length === 0) {
      throw new BadRequestException('No fields to update');
    }

    // Add updated_at
    updateFields.push(`updated_at = NOW()`);

    values.push(userId);

    try {
      const query = `UPDATE user_sys SET ${updateFields.join(', ')} WHERE user_sys_id = $${index} RETURNING *`;
      const result = await this.dataSource.query(query, values);

      if (result.length === 0) {
        throw new NotFoundException('User not found');
      }

      // Remove password from response
      const { password, ...userData } = result[0];
      return { message: 'Profile updated successfully', data: userData };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error updating profile:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  /**
   * Get teaching schedule for educators
   */
  async getTeachingSchedule(educatorId: number): Promise<any> {
    const query = `
      SELECT 
        ss.schedule_id,
        ss.day_of_week,
        ss.start_time,
        ss.end_time,
        s.section_name,
        subj.subject_code,
        subj.name_th AS subject_name,
        ss.room_location_id
      FROM section_schedule ss
      LEFT JOIN section s ON s.section_id = ss.section_id
      LEFT JOIN section_educator se ON se.section_id = s.section_id
      LEFT JOIN subject subj ON subj.subject_id = s.subject_id
      WHERE se.educator_id = $1 AND se.flag_valid = true AND ss.flag_valid = true
      ORDER BY ss.day_of_week ASC, ss.start_time ASC
    `;

    try {
      const schedules = await this.dataSource.query(query, [educatorId]);
      
      return {
        success: true,
        message: 'Teaching schedules retrieved successfully',
        data: schedules.map(schedule => ({
          scheduleId: schedule.schedule_id,
          dayOfWeek: schedule.day_of_week,
          startTime: schedule.start_time,
          endTime: schedule.end_time,
          className: schedule.section_name,
          subjectName: schedule.subject_name,
          subjectCode: schedule.subject_code,
          building: schedule.room_location_id || '-',
        })),
      };
    } catch (error) {
      console.error('Error fetching teaching schedule:', error);
      throw new InternalServerErrorException('Failed to fetch teaching schedule');
    }
  }
}
