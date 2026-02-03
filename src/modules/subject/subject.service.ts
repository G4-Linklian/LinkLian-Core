// subject.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Subject } from './entities/subject.entity';
import { SearchSubjectDto, CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@Injectable()
export class SubjectService {
  constructor(
    @InjectRepository(Subject)
    private subjectRepo: Repository<Subject>,
    private dataSource: DataSource,
  ) {}

  /**
   * Find subject by ID
   */
  async findById(id: number) {
    const subject = await this.subjectRepo.findOne({
      where: { subject_id: id }
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    return subject;
  }

  /**
   * Search subjects with filters, pagination, and keyword search
   * Joins with learning_area table
   */
  async search(dto: SearchSubjectDto) {
    // Validate that at least one search parameter is provided
    const hasInput = dto.subject_id || dto.learning_area_id ||
                     dto.subject_code || dto.name_th ||
                     dto.name_en || dto.credit ||
                     dto.hour_per_week || dto.inst_id ||
                     dto.keyword || typeof dto.flag_valid === 'boolean';

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
      const result = await this.dataSource.query(query, values);
      return { data: result };
    } catch (error) {
      console.error('Error fetching subjects:', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }

  /**
   * Create a new subject
   */
  async create(dto: CreateSubjectDto) {
    if (!dto.learning_area_id || !dto.subject_code || !dto.name_th || !dto.credit || !dto.hour_per_week) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newSubject = this.subjectRepo.create({
        learning_area_id: dto.learning_area_id,
        subject_code: dto.subject_code,
        name_th: dto.name_th,
        name_en: dto.name_en || null,
        credit: dto.credit,
        hour_per_week: dto.hour_per_week,
        flag_valid: true,
      });

      const savedSubject = await this.subjectRepo.save(newSubject);
      return { message: 'Subject created successfully!', data: savedSubject };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This subject already exists in the system');
      }
      console.error('Error creating subject:', error);
      throw new InternalServerErrorException('Error creating subject');
    }
  }

  /**
   * Update an existing subject
   */
  async update(id: number, dto: UpdateSubjectDto) {
    // Check if subject exists
    const existingSubject = await this.subjectRepo.findOne({
      where: { subject_id: id }
    });

    if (!existingSubject) {
      throw new NotFoundException('Subject not found');
    }

    // Build update object dynamically
    const updates: Partial<Subject> = {};

    if (dto.learning_area_id !== undefined) updates.learning_area_id = dto.learning_area_id;
    if (dto.subject_code !== undefined) updates.subject_code = dto.subject_code;
    if (dto.name_th !== undefined) updates.name_th = dto.name_th;
    if (dto.name_en !== undefined) updates.name_en = dto.name_en;
    if (dto.credit !== undefined) updates.credit = dto.credit;
    if (dto.hour_per_week !== undefined) updates.hour_per_week = dto.hour_per_week;
    if (typeof dto.flag_valid === 'boolean') updates.flag_valid = dto.flag_valid;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.subjectRepo.update({ subject_id: id }, updates);

      const updatedSubject = await this.subjectRepo.findOne({
        where: { subject_id: id }
      });

      return { message: 'Subject updated successfully!', data: updatedSubject };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This subject already exists in the system');
      }
      console.error('Error updating subject:', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Delete a subject by ID
   */
  async delete(id: number) {
    // Check if subject exists
    const existingSubject = await this.subjectRepo.findOne({
      where: { subject_id: id }
    });

    if (!existingSubject) {
      throw new NotFoundException('Subject not found');
    }

    try {
      await this.subjectRepo.delete({ subject_id: id });
      return { message: 'Subject deleted successfully!', data: existingSubject };

    } catch (error) {
      console.error('Error deleting subject:', error);
      throw new InternalServerErrorException('Error deleting subject');
    }
  }
}
