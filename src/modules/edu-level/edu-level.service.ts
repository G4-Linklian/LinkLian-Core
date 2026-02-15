// edu-level.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EduLevel } from './entities/edu-level.entity';
import { EduLevelProgramNormalize } from './entities/edu-level-program-normalize.entity';
import { 
  SearchEduLevelMasterDto, 
  SearchEduLevelDto, 
  CreateEduLevelDto, 
  UpdateEduLevelDto,
  CreateEduLevelNormDto,
  DeleteEduLevelNormDto 
} from './dto/edu-level.dto';

@Injectable()
export class EduLevelService {
  constructor(
    @InjectRepository(EduLevel)
    private eduLevelRepo: Repository<EduLevel>,
    @InjectRepository(EduLevelProgramNormalize)
    private eduLevelNormRepo: Repository<EduLevelProgramNormalize>,
    private dataSource: DataSource,
  ) {}

  // ========== EduLevel Master Methods ==========

  /**
   * Find edu_level by ID
   */
  async findById(id: number) {
    const eduLevel = await this.eduLevelRepo.findOne({
      where: { edu_lev_id: id }
    });

    if (!eduLevel) {
      throw new NotFoundException('EduLevel not found');
    }

    return eduLevel;
  }

  /**
   * Search edu_level master data with filters
   */
  async searchMaster(dto: SearchEduLevelMasterDto) {
    // Validate that at least one search parameter is provided
    const hasInput = dto.edu_lev_id || dto.level_name ||
                     dto.edu_type || typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    let query = `SELECT * FROM edu_level e WHERE 1=1`;
    const values: any[] = [];
    let index = 1;

    if (dto.edu_lev_id) {
      query += ` AND e.edu_lev_id = $${index++}`;
      values.push(dto.edu_lev_id);
    }

    if (dto.level_name) {
      query += ` AND e.level_name = $${index++}`;
      values.push(dto.level_name);
    }

    if (dto.edu_type) {
      query += ` AND e.edu_type = $${index++}`;
      values.push(dto.edu_type);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND e.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    try {
      const result = await this.dataSource.query(query, values);
      return result;
    } catch (err) {
      console.error('Error fetching edu levels:', err);
      throw new InternalServerErrorException('Error fetching edu levels');
    }
  }

  /**
   * Search edu_level with program joins
   * Includes total_count for pagination
   */
  async search(dto: SearchEduLevelDto) {
    // Validate that at least one search parameter is provided
    const hasInput = dto.edu_lev_id || dto.level_name ||
                     dto.edu_type || dto.program_id ||
                     dto.inst_id || dto.parent_id ||
                     typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    // Build query with JOINs to edu_level_program_normalize and program tables
    let query = `
      SELECT *, COUNT(*) OVER() as total_count 
      FROM edu_level e
      LEFT JOIN edu_level_program_normalize elpn ON e.edu_lev_id = elpn.edu_lev_id
      LEFT JOIN program p ON elpn.program_id = p.program_id
      WHERE 1=1
      AND p.inst_id IS NOT NULL
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.edu_lev_id) {
      query += ` AND e.edu_lev_id = $${index++}`;
      values.push(dto.edu_lev_id);
    }

    if (dto.level_name) {
      query += ` AND e.level_name = $${index++}`;
      values.push(dto.level_name);
    }

    if (dto.edu_type) {
      query += ` AND e.edu_type = $${index++}`;
      values.push(dto.edu_type);
    }

    if (dto.program_id) {
      query += ` AND elpn.program_id = $${index++}`;
      values.push(dto.program_id);
    }

    if (dto.inst_id) {
      query += ` AND p.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    if (dto.parent_id) {
      query += ` AND p.parent_id = $${index++}`;
      values.push(dto.parent_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND e.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY e.${dto.sort_by}, p.program_id ${order}`;
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
      console.error('Error fetching edu levels:', err);
      throw new InternalServerErrorException('Error fetching edu levels');
    }
  }

  /**
   * Create a new edu_level
   */
  async create(dto: CreateEduLevelDto) {
    if (!dto.level_name || !dto.edu_type) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newEduLevel = this.eduLevelRepo.create({
        level_name: dto.level_name,
        edu_type: dto.edu_type,
        flag_valid: true,
      });

      const savedEduLevel = await this.eduLevelRepo.save(newEduLevel);
      return savedEduLevel;

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This education level already exists');
      }
      console.error('Error creating edu level:', error);
      throw new InternalServerErrorException('Error creating edu level');
    }
  }

  /**
   * Update an existing edu_level
   */
  async update(id: number, dto: UpdateEduLevelDto) {
    // Check if edu_level exists
    const existingEduLevel = await this.eduLevelRepo.findOne({
      where: { edu_lev_id: id }
    });

    if (!existingEduLevel) {
      throw new NotFoundException('EduLevel not found');
    }

    // Build update object dynamically
    const updates: Partial<EduLevel> = {};

    if (dto.level_name !== undefined) updates.level_name = dto.level_name;
    if (dto.edu_type !== undefined) updates.edu_type = dto.edu_type;
    if (typeof dto.flag_valid === 'boolean') updates.flag_valid = dto.flag_valid;

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.eduLevelRepo.update({ edu_lev_id: id }, updates);

      const updatedEduLevel = await this.eduLevelRepo.findOne({
        where: { edu_lev_id: id }
      });

      return updatedEduLevel;

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This education level already exists');
      }
      console.error('Error updating edu level:', error);
      throw new InternalServerErrorException('Error updating edu level');
    }
  }

  /**
   * Delete an edu_level by ID
   */
  async delete(id: number) {
    // Check if edu_level exists
    const existingEduLevel = await this.eduLevelRepo.findOne({
      where: { edu_lev_id: id }
    });

    if (!existingEduLevel) {
      throw new NotFoundException('EduLevel not found');
    }

    try {
      await this.eduLevelRepo.delete({ edu_lev_id: id });
      return existingEduLevel;

    } catch (error) {
      console.error('Error deleting edu level:', error);
      throw new InternalServerErrorException('Error deleting edu level');
    }
  }

  // ========== EduLevel Normalize Methods ==========

  /**
   * Create a new edu_level_program_normalize record
   */
  async createNormalize(dto: CreateEduLevelNormDto) {
    if (!dto.edu_lev_id || !dto.program_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newNorm = this.eduLevelNormRepo.create({
        edu_lev_id: dto.edu_lev_id,
        program_id: dto.program_id,
        flag_valid: true,
      });

      const savedNorm = await this.eduLevelNormRepo.save(newNorm);
      return savedNorm;

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This class has already been added');
      }
      console.error('Error creating edu level normalize:', error);
      throw new InternalServerErrorException('Error creating edu level normalize');
    }
  }

  /**
   * Update edu_level_program_normalize to set flag_valid = true
   */
  async updateNormalize(dto: CreateEduLevelNormDto) {
    if (!dto.edu_lev_id || !dto.program_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const query = `UPDATE edu_level_program_normalize SET flag_valid = true WHERE edu_lev_id = $1 AND program_id = $2 RETURNING *`;
      const result = await this.dataSource.query(query, [dto.edu_lev_id, dto.program_id]);

      if (result.length === 0) {
        throw new NotFoundException('EduLevel normalize record not found');
      }

      return result[0];

    } catch (error: any) {
      if (error instanceof NotFoundException) throw error;
      if (error.code === '23505') {
        throw new ConflictException('This class has already been added');
      }
      console.error('Error updating edu level normalize:', error);
      throw new InternalServerErrorException('Error updating edu level normalize');
    }
  }

  /**
   * Delete edu_level_program_normalize record
   */
  async deleteNormalize(dto: DeleteEduLevelNormDto) {
    if (!dto.edu_lev_id || !dto.program_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const query = `DELETE FROM edu_level_program_normalize WHERE edu_lev_id = $1 AND program_id = $2 RETURNING *`;
      const result = await this.dataSource.query(query, [dto.edu_lev_id, dto.program_id]);

      if (result.length === 0) {
        throw new NotFoundException('EduLevel normalize record not found');
      }

      return result[0];

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error deleting edu level normalize:', error);
      throw new InternalServerErrorException('Error deleting edu level normalize');
    }
  }
}
