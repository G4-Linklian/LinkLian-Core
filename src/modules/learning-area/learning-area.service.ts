// learning-area.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LearningArea } from './entities/learning-area.entity';
import { UserSysLearningAreaNormalize } from './entities/user-sys-learning-area-normalize.entity';
import {
  SearchLearningAreaDto,
  CreateLearningAreaDto,
  UpdateLearningAreaDto,
  CreateLearningAreaUserSysDto,
  UpdateLearningAreaUserSysDto,
  DeleteLearningAreaUserSysDto
} from './dto/learning-area.dto';

@Injectable()
export class LearningAreaService {
  constructor(
    @InjectRepository(LearningArea)
    private learningAreaRepo: Repository<LearningArea>,
    @InjectRepository(UserSysLearningAreaNormalize)
    private userSysLearningAreaNormRepo: Repository<UserSysLearningAreaNormalize>,
    private dataSource: DataSource,
  ) {}

  // ========== Learning Area Methods ==========

  /**
   * Find learning area by ID
   */
  async findById(id: number) {
    const learningArea = await this.learningAreaRepo.findOne({
      where: { learning_area_id: id }
    });

    if (!learningArea) {
      throw new NotFoundException('Learning area not found');
    }

    return learningArea;
  }

  /**
   * Search learning areas with filters and pagination
   * Optionally includes subject count with GROUP BY
   */
  async search(dto: SearchLearningAreaDto) {
    // Validate that at least one search parameter is provided
    const hasInput = dto.learning_area_id || dto.inst_id ||
                     dto.learning_area_name || dto.remark ||
                     typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    // Build dynamic query based on subject_count flag
    let query = `SELECT la.*, COUNT(*) OVER() as total_count`;

    if (dto.subject_count) {
      query += `, COUNT(s.subject_id) AS subject_count`;
    }

    query += ` FROM learning_area la`;

    if (dto.subject_count) {
      query += ` LEFT JOIN subject s ON la.learning_area_id = s.learning_area_id`;
    }

    query += ` LEFT JOIN institution i ON la.inst_id = i.inst_id`;
    query += ` WHERE 1=1`;

    const values: any[] = [];
    let index = 1;

    if (dto.learning_area_id) {
      query += ` AND la.learning_area_id = $${index++}`;
      values.push(dto.learning_area_id);
    }

    if (dto.inst_id) {
      query += ` AND la.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    if (dto.learning_area_name) {
      query += ` AND la.learning_area_name = $${index++}`;
      values.push(dto.learning_area_name);
    }

    if (dto.remark) {
      query += ` AND la.remark = $${index++}`;
      values.push(dto.remark);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND la.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    // GROUP BY must come before ORDER BY
    if (dto.subject_count) {
      query += ` GROUP BY la.learning_area_id`;
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${dto.sort_by} ${order}`;
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
      return result;
    } catch (err) {
      console.error('Error fetching learning areas:', err);
      throw new InternalServerErrorException('Error fetching learning areas');
    }
  }

  /**
   * Create a new learning area
   */
  async create(dto: CreateLearningAreaDto) {
    if (!dto.inst_id || !dto.learning_area_name) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newLearningArea = this.learningAreaRepo.create({
        inst_id: dto.inst_id,
        learning_area_name: dto.learning_area_name,
        remark: dto.remark || null,
        flag_valid: true,
      });

      const savedLearningArea = await this.learningAreaRepo.save(newLearningArea);
      return { message: 'Learning area created successfully!', data: savedLearningArea };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This learning area already exists in the system');
      }
      console.error('Error creating learning area:', error);
      throw new InternalServerErrorException('Error creating learning area');
    }
  }

  /**
   * Update an existing learning area
   */
  async update(id: number, dto: UpdateLearningAreaDto) {
    // Check if learning area exists
    const existingLearningArea = await this.learningAreaRepo.findOne({
      where: { learning_area_id: id }
    });

    if (!existingLearningArea) {
      throw new NotFoundException('Learning area not found');
    }

    // Build update object dynamically
    const updates: Partial<LearningArea> = {};

    if (dto.inst_id !== undefined) updates.inst_id = dto.inst_id;
    if (dto.learning_area_name !== undefined) updates.learning_area_name = dto.learning_area_name;
    if (dto.remark !== undefined) updates.remark = dto.remark;
    if (typeof dto.flag_valid === 'boolean') updates.flag_valid = dto.flag_valid;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.learningAreaRepo.update({ learning_area_id: id }, updates);

      const updatedLearningArea = await this.learningAreaRepo.findOne({
        where: { learning_area_id: id }
      });

      return { message: 'Learning area updated successfully!', data: updatedLearningArea };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This learning area already exists');
      }
      console.error('Error updating learning area:', error);
      throw new InternalServerErrorException('Error updating learning area');
    }
  }

  /**
   * Delete a learning area by ID
   */
  async delete(id: number) {
    // Check if learning area exists
    const existingLearningArea = await this.learningAreaRepo.findOne({
      where: { learning_area_id: id }
    });

    if (!existingLearningArea) {
      throw new NotFoundException('Learning area not found');
    }

    try {
      await this.learningAreaRepo.delete({ learning_area_id: id });
      return { message: 'Learning area deleted successfully!', data: existingLearningArea };

    } catch (error) {
      console.error('Error deleting learning area:', error);
      throw new InternalServerErrorException('Error deleting learning area');
    }
  }

  // ========== User Sys Learning Area Normalize Methods ==========

  /**
   * Create user_sys_learning_area_normalize record
   */
  async createUserSysNormalize(dto: CreateLearningAreaUserSysDto) {
    if (!dto.learning_area_id || !dto.user_sys_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newNorm = this.userSysLearningAreaNormRepo.create({
        learning_area_id: dto.learning_area_id,
        user_sys_id: dto.user_sys_id,
        flag_valid: true,
      });

      const savedNorm = await this.userSysLearningAreaNormRepo.save(newNorm);
      return { message: 'Learning area user sys created successfully!', data: savedNorm };

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This user is already assigned to this learning area');
      }
      console.error('Error creating learning area user sys:', error);
      throw new InternalServerErrorException('Error creating learning area user sys');
    }
  }

  /**
   * Update user_sys_learning_area_normalize record
   */
  async updateUserSysNormalize(dto: UpdateLearningAreaUserSysDto) {
    if (!dto.user_sys_id || !dto.learning_area_id) {
      throw new BadRequestException('Missing required fields!');
    }

    // Build update object
    const updates: any = {};
    if (dto.learning_area_id !== undefined) updates.learning_area_id = dto.learning_area_id;
    if (typeof dto.flag_valid === 'boolean') updates.flag_valid = dto.flag_valid;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      const query = `UPDATE user_sys_learning_area_normalize SET learning_area_id = $1, flag_valid = $2 WHERE user_sys_id = $3 RETURNING *`;
      const result = await this.dataSource.query(query, [
        dto.learning_area_id,
        dto.flag_valid ?? true,
        dto.user_sys_id
      ]);

      if (result.length === 0) {
        throw new NotFoundException('User sys learning area normalize record not found');
      }

      return { message: 'Learning area user sys updated successfully!', data: result[0] };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error updating learning area user sys:', error);
      throw new InternalServerErrorException('Error updating learning area user sys');
    }
  }

  /**
   * Delete user_sys_learning_area_normalize record
   */
  async deleteUserSysNormalize(dto: DeleteLearningAreaUserSysDto) {
    if (!dto.learning_area_id || !dto.user_sys_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const query = `DELETE FROM user_sys_learning_area_normalize WHERE learning_area_id = $1 AND user_sys_id = $2 RETURNING *`;
      const result = await this.dataSource.query(query, [dto.learning_area_id, dto.user_sys_id]);

      if (result.length === 0) {
        throw new NotFoundException('User sys learning area normalize record not found');
      }

      return { message: 'Learning area user sys deleted successfully!', data: result[0] };

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error deleting learning area user sys:', error);
      throw new InternalServerErrorException('Error deleting learning area user sys');
    }
  }

  /**
   * Internal function to create user_sys_learning_area_normalize record
   * Used by other services
   */
  async createUserSysNormalizeInternal(user_sys_id: number, learning_area_id: number) {
    if (!user_sys_id || !learning_area_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newNorm = this.userSysLearningAreaNormRepo.create({
        learning_area_id,
        user_sys_id,
        flag_valid: true,
      });

      return await this.userSysLearningAreaNormRepo.save(newNorm);
    } catch (error) {
      console.error('Error creating learning area user sys internally:', error);
      throw error;
    }
  }
}
