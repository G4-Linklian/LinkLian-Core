// subject.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Subject } from './entities/subject.entity';
import {
  SearchSubjectDto,
  CreateSubjectDto,
  UpdateSubjectDto,
} from './dto/subject.dto';
import { subjectFields } from 'src/common/interface/subject.interface';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class SubjectService {
  constructor(
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    private dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Find subject by ID
   */
  async findById(id: number) {
    const subject = await this.subjectRepo.findOne({
      where: { subject_id: id },
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return { success: true, data: subject };
  }

  /**
   * Search subjects with filters, pagination, and keyword search
   * Joins with learning_area table
   */
  async search(dto: SearchSubjectDto) {
    // Validate that at least one search parameter is provided
    const hasInput =
      dto.subject_id ||
      dto.learning_area_id ||
      dto.subject_code ||
      dto.name_th ||
      dto.name_en ||
      dto.credit ||
      dto.hour_per_week ||
      dto.inst_id ||
      dto.keyword ||
      typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    let query = `
      SELECT *, COUNT(*) OVER() as total_count 
      FROM subject s
      LEFT JOIN learning_area la ON s.learning_area_id = la.learning_area_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.subject_id) {
      query += ` AND s.subject_id = $${index++}`;
      values.push(dto.subject_id);
    }

    if (dto.learning_area_id) {
      query += ` AND s.learning_area_id = $${index++}`;
      values.push(dto.learning_area_id);
    }

    if (dto.subject_code) {
      query += ` AND s.subject_code = $${index++}`;
      values.push(dto.subject_code);
    }

    if (dto.name_th) {
      query += ` AND s.name_th = $${index++}`;
      values.push(dto.name_th);
    }

    if (dto.name_en) {
      query += ` AND s.name_en = $${index++}`;
      values.push(dto.name_en);
    }

    if (dto.credit) {
      query += ` AND s.credit = $${index++}`;
      values.push(dto.credit);
    }

    if (dto.hour_per_week) {
      query += ` AND s.hour_per_week = $${index++}`;
      values.push(dto.hour_per_week);
    }

    if (dto.inst_id) {
      query += ` AND la.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND s.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    // Keyword search with ILIKE for case-insensitive partial match
    if (dto.keyword) {
      query += ` AND (s.subject_code ILIKE $${index} OR s.name_th ILIKE $${index})`;
      values.push(`%${dto.keyword}%`);
      index++;
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
      const result: subjectFields[] = await this.dataSource.query(
        query,
        values,
      );
      return { success: true, data: result };
    } catch (error: unknown) {
      this.logger.error('Error fetching subjects:', 'GetSubject', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  /**
   * Create a new subject
   */
  async create(dto: CreateSubjectDto) {
    if (
      !dto.learning_area_id ||
      !dto.subject_code ||
      !dto.name_th ||
      !dto.credit ||
      !dto.hour_per_week
    ) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const query = `
        INSERT INTO subject 
        (learning_area_id, subject_code, name_th, name_en, credit, hour_per_week, flag_valid, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;

      const values = [
        dto.learning_area_id,
        dto.subject_code,
        dto.name_th,
        dto.name_en || null,
        dto.credit,
        dto.hour_per_week,
        true,
      ];

      const result: subjectFields[] = await this.dataSource.query(
        query,
        values,
      );
      return {
        success: true,
        data: result[0],
        message: 'Subject created successfully',
      };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'This subject already exists in the system',
        );
      }
      this.logger.error('Error creating subject:', 'CreateSubject', error);
      throw new InternalServerErrorException('Error creating subject');
    }
  }

  /**
   * Update an existing subject
   */
  async update(id: number, dto: UpdateSubjectDto) {
    // Check if subject exists
    const existingSubject = await this.subjectRepo.findOne({
      where: { subject_id: id },
    });

    if (!existingSubject) {
      throw new NotFoundException('Subject not found');
    }

    // Build update object dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.learning_area_id !== undefined) {
      updateFields.push(`learning_area_id = $${index++}`);
      values.push(dto.learning_area_id);
    }

    if (dto.subject_code !== undefined) {
      updateFields.push(`subject_code = $${index++}`);
      values.push(dto.subject_code);
    }

    if (dto.name_th !== undefined) {
      updateFields.push(`name_th = $${index++}`);
      values.push(dto.name_th);
    }

    if (dto.name_en !== undefined) {
      updateFields.push(`name_en = $${index++}`);
      values.push(dto.name_en);
    }

    if (dto.credit !== undefined) {
      updateFields.push(`credit = $${index++}`);
      values.push(dto.credit);
    }

    if (dto.hour_per_week !== undefined) {
      updateFields.push(`hour_per_week = $${index++}`);
      values.push(dto.hour_per_week);
    }

    if (typeof dto.flag_valid === 'boolean') {
      updateFields.push(`flag_valid = $${index++}`);
      values.push(dto.flag_valid);
    }

    if (updateFields.length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    // Add updated_at
    updateFields.push(`updated_at = NOW()`);
    values.push(id);

    try {
      const query = `UPDATE subject SET ${updateFields.join(', ')} WHERE subject_id = $${index} RETURNING *`;
      const result: subjectFields[] = await this.dataSource.query(
        query,
        values,
      );

      return {
        success: true,
        data: result[0],
        message: 'Subject updated successfully',
      };
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException(
          'This subject already exists in the system',
        );
      }
      this.logger.error('Error updating subject:', 'UpdateSubject', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Delete a subject by ID
   */
  async delete(id: number) {
    // Check if subject exists
    const existingSubject = await this.subjectRepo.findOne({
      where: { subject_id: id },
    });

    if (!existingSubject) {
      throw new NotFoundException('Subject not found');
    }

    try {
      await this.subjectRepo.delete({ subject_id: id });
      return {
        success: true,
        data: existingSubject,
        message: 'Subject deleted successfully',
      };
    } catch (error: unknown) {
      this.logger.error('Error deleting subject:', 'DeleteSubject', error);
      throw new InternalServerErrorException('Error deleting subject');
    }
  }
}
