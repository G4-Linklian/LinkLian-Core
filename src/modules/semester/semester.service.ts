// semester.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Semester } from './entities/semester.entity';
import { SemesterSubjectNormalize } from './entities/semester-subject-normalize.entity';
import {
  SearchSemesterDto,
  CreateSemesterDto,
  UpdateSemesterDto,
  CreateSemesterSubjectDto,
  DeleteSemesterSubjectDto
} from './dto/semester.dto';

@Injectable()
export class SemesterService {
  constructor(
    @InjectRepository(Semester)
    private semesterRepo: Repository<Semester>,
    @InjectRepository(SemesterSubjectNormalize)
    private semesterSubjectRepo: Repository<SemesterSubjectNormalize>,
    private dataSource: DataSource,
  ) {}

  // ========== Semester Methods ==========

  /**
   * Find semester by ID
   */
  async findById(id: number) {
    const semester = await this.semesterRepo.findOne({
      where: { semester_id: id }
    });

    if (!semester) {
      throw new NotFoundException('Semester not found');
    }

    return { data : semester };
  }

  /**
   * Search semesters with filters and pagination
   */
  async search(dto: SearchSemesterDto) {
    // Validate that at least one search parameter is provided
    const hasInput = dto.semester_id || dto.inst_id ||
                     dto.semester || dto.start_date ||
                     dto.end_date || dto.status ||
                     typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    let query = `
      SELECT *, COUNT(*) OVER() as total_count 
      FROM semester s
      WHERE 1=1
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.semester_id) {
      query += ` AND s.semester_id = $${index++}`;
      values.push(dto.semester_id);
    }

    if (dto.inst_id) {
      query += ` AND s.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    if (dto.semester) {
      query += ` AND s.semester = $${index++}`;
      values.push(dto.semester);
    }

    // Handle date range filtering
    if (dto.start_date && dto.end_date) {
      query += ` AND s.start_date >= $${index} AND s.end_date <= $${index + 1}`;
      values.push(dto.start_date, dto.end_date);
      index += 2;
    } else if (dto.start_date) {
      query += ` AND s.start_date = $${index++}`;
      values.push(dto.start_date);
    } else if (dto.end_date) {
      query += ` AND s.end_date = $${index++}`;
      values.push(dto.end_date);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND s.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    if (dto.status) {
      query += ` AND s.status = $${index++}`;
      values.push(dto.status);
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
      return { data : result };
    } catch (error) {
      console.error('Error fetching semesters:', error);
      throw new InternalServerErrorException('Error fetching data');
    }
  }

  /**
   * Get active semesters (open + close) sorted by semester name (year then term)
   * Returns semesters with status 'open' or 'close', ordered from oldest to newest
   * Sorts by extracting year and term from semester name (e.g., "1/2567", "2/2567")
   */
  async getActiveSemesters() {
    try {
      const query = `
        SELECT 
          *,
          CAST(SUBSTRING(semester FROM '/([0-9]+)$') AS INTEGER) as year_numeric,
          CAST(SUBSTRING(semester FROM '^([0-9]+)/') AS INTEGER) as term_numeric
        FROM semester
        WHERE status IN ('open', 'close')
          AND flag_valid = true
        ORDER BY 
          year_numeric ASC,
          term_numeric ASC
      `;

      const result = await this.dataSource.query(query);
      return result;
    } catch (error) {
      console.error('Error fetching active semesters:', error);
      throw new InternalServerErrorException('Error fetching active semesters');
    }
  }

  /**
   * Create a new semester
   */
  async create(dto: CreateSemesterDto) {
    if (!dto.inst_id || !dto.semester || !dto.start_date || !dto.end_date || typeof dto.flag_valid !== 'boolean') {
      throw new BadRequestException('Missing required fields!');
    }

    // Default status to pending if not provided
    const status = dto.status || 'pending';

    try {
      const newSemester = this.semesterRepo.create({
        inst_id: dto.inst_id,
        semester: dto.semester,
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
        flag_valid: dto.flag_valid,
        status: status,
      });

      const savedSemester = await this.semesterRepo.save(newSemester);
      return { message: 'Semester created successfully!', data: savedSemester };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This semester already exists');
      }
      console.error('Error creating semester:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Update an existing semester
   */
  async update(id: number, dto: UpdateSemesterDto) {
    // Check if semester exists
    const existingSemester = await this.semesterRepo.findOne({
      where: { semester_id: id }
    });

    if (!existingSemester) {
      throw new NotFoundException('Semester not found');
    }

    // Build update object dynamically
    const updates: Partial<Semester> = {};

    if (dto.inst_id !== undefined) updates.inst_id = dto.inst_id;
    if (dto.semester !== undefined) updates.semester = dto.semester;
    if (dto.start_date !== undefined) updates.start_date = new Date(dto.start_date);
    if (dto.end_date !== undefined) updates.end_date = new Date(dto.end_date);
    if (typeof dto.flag_valid === 'boolean') updates.flag_valid = dto.flag_valid;
    if (dto.status !== undefined) updates.status = dto.status;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.semesterRepo.update({ semester_id: id }, updates);

      const updatedSemester = await this.semesterRepo.findOne({
        where: { semester_id: id }
      });

      return { message: 'Semester updated successfully!', data: updatedSemester };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This semester already exists');
      }
      console.error('Error updating semester:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Delete a semester by ID
   */
  async delete(id: number) {
    // Check if semester exists
    const existingSemester = await this.semesterRepo.findOne({
      where: { semester_id: id }
    });

    if (!existingSemester) {
      throw new NotFoundException('Semester not found');
    }

    try {
      await this.semesterRepo.delete({ semester_id: id });
      return { message: 'Semester deleted successfully!', data: existingSemester };

    } catch (error) {
      console.error('Error deleting semester:', error);
      throw new InternalServerErrorException('Error deleting semester');
    }
  }

  // ========== Semester Subject Normalize Methods ==========

  /**
   * Create semester_subject_normalize record
   */
  async createSemesterSubject(dto: CreateSemesterSubjectDto) {
    if (!dto.subject_id || !dto.semester_id || typeof dto.flag_valid !== 'boolean') {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newRecord = this.semesterSubjectRepo.create({
        subject_id: dto.subject_id,
        semester_id: dto.semester_id,
        flag_valid: dto.flag_valid,
      });

      const savedRecord = await this.semesterSubjectRepo.save(newRecord);
      return { message: 'Semester subject created successfully!', data: savedRecord };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This subject is already linked to this semester');
      }
      console.error('Error creating semester subject:', error);
      throw new InternalServerErrorException('Error creating semester subject');
    }
  }

  /**
   * Delete semester_subject_normalize record
   */
  async deleteSemesterSubject(dto: DeleteSemesterSubjectDto) {
    if (!dto.subject_id || !dto.semester_id) {
      throw new BadRequestException('Subject ID and Semester ID are required for deletion!');
    }

    try {
      const query = `DELETE FROM semester_subject_normalize WHERE subject_id = $1 AND semester_id = $2 RETURNING *`;
      const result = await this.dataSource.query(query, [dto.subject_id, dto.semester_id]);

      if (result.length === 0) {
        throw new NotFoundException('Semester subject record not found');
      }

      return { message: 'Semester subject deleted successfully!', data: result[0] };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error deleting semester subject:', error);
      throw new InternalServerErrorException('Error deleting semester subject');
    }
  }
}
