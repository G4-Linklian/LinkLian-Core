// program.service.ts
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Program } from './entities/program.entity';
import { UserSysProgramNormalize } from './entities/user-sys-program-normalize.entity';
import {
  SearchProgramDto,
  CreateProgramDto,
  UpdateProgramDto,
  CreateProgramUserSysDto,
  UpdateProgramUserSysDto,
  DeleteProgramUserSysDto
} from './dto/program.dto';

@Injectable()
export class ProgramService {
  constructor(
    @InjectRepository(Program)
    private programRepo: Repository<Program>,
    @InjectRepository(UserSysProgramNormalize)
    private userSysProgramNormRepo: Repository<UserSysProgramNormalize>,
    private dataSource: DataSource,
  ) {}

  // ========== Program Methods ==========

  /**
   * Find program by ID
   */
  async findById(id: number) {
    const program = await this.programRepo.findOne({
      where: { program_id: id }
    });

    if (!program) {
      throw new NotFoundException('Program not found');
    }

    return program;
  }

  /**
   * Search programs with filters, pagination, and optional children count
   * Uses recursive CTE to count children in the program tree
   */
  async search(dto: SearchProgramDto) {
    // Validate that at least one search parameter is provided
    const hasInput = dto.program_id || dto.inst_id ||
                     dto.program_name || dto.program_type ||
                     dto.parent_id || dto.tree_type ||
                     dto.parent_ids || dto.inst_type ||
                     dto.keyword || typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    // Build dynamic query with optional children_count using recursive CTE
    let query = `
      SELECT
        p.*,
        i.inst_type,
        COUNT(*) OVER() AS total_count
    `;

    // Add children_count subquery if requested
    if (dto.children_count) {
      query += `,
        (
          WITH RECURSIVE program_tree AS (
            SELECT
              p2.program_id,
              p2.parent_id,
              p2.tree_type
            FROM program p2
            WHERE p2.program_id = p.program_id
          
            UNION ALL
          
            SELECT
              c.program_id,
              c.parent_id,
              c.tree_type
            FROM program c
            INNER JOIN program_tree pt
              ON c.parent_id = pt.program_id
          )
          SELECT COUNT(*)
          FROM edu_level_program_normalize elpn
          WHERE elpn.program_id IN (
            SELECT program_id
            FROM program_tree
            WHERE tree_type = 'leaf'
          )
        ) AS children_count
      `;
    }

    query += `
      FROM program p
      LEFT JOIN institution i ON p.inst_id = i.inst_id
      WHERE 1=1
    `;

    const values: any[] = [];
    let index = 1;

    if (dto.program_id) {
      query += ` AND p.program_id = $${index++}`;
      values.push(dto.program_id);
    }

    if (dto.inst_id) {
      query += ` AND p.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    if (dto.program_name) {
      query += ` AND p.program_name = $${index++}`;
      values.push(dto.program_name);
    }

    if (dto.program_type) {
      query += ` AND p.program_type = $${index++}`;
      values.push(dto.program_type);
    }

    if (dto.parent_id) {
      query += ` AND p.parent_id = $${index++}`;
      values.push(dto.parent_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND p.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    if (dto.tree_type) {
      query += ` AND p.tree_type = $${index++}`;
      values.push(dto.tree_type);
    }

    if (dto.inst_type) {
      query += ` AND i.inst_type = $${index++}`;
      values.push(dto.inst_type);
    }

    if (dto.parent_ids) {
      query += ` AND p.parent_id = $${index++}`;
      values.push(dto.parent_ids);
    }

    // Keyword search with ILIKE for case-insensitive partial match
    if (dto.keyword) {
      query += ` AND (p.program_name ILIKE $${index++} OR p.remark ILIKE $${index++})`;
      values.push(`%${dto.keyword}%`);
      values.push(`%${dto.keyword}%`);
    }

    // GROUP BY for aggregation
    query += ` GROUP BY p.program_id, i.inst_type`;

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
      console.error('Error fetching programs:', err);
      throw new InternalServerErrorException('Error fetching programs');
    }
  }

  /**
   * Create a new program
   */
  async create(dto: CreateProgramDto) {
    if (!dto.inst_id || !dto.program_name || !dto.program_type || !dto.tree_type) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const query = `
        INSERT INTO program
        (inst_id, program_name, program_type, tree_type, parent_id, remark, flag_valid, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *
      `;

      const values = [
        dto.inst_id,
        dto.program_name,
        dto.program_type,
        dto.tree_type,
        dto.parent_id || null,
        dto.remark || null,
        true,
      ];

      const result = await this.dataSource.query(query, values);
      return result[0];

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('Cannot add duplicate program');
      }
      console.error('Error creating program:', error);
      throw new InternalServerErrorException('Error creating program');
    }
  }

  /**
   * Update an existing program
   */
  async update(id: number, dto: UpdateProgramDto) {
    // Check if program exists
    const existingProgram = await this.programRepo.findOne({
      where: { program_id: id }
    });

    if (!existingProgram) {
      throw new NotFoundException('Program not found');
    }

    // Build update fields dynamically
    const updateFields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.inst_id !== undefined) {
      updateFields.push(`inst_id = $${index++}`);
      values.push(dto.inst_id);
    }

    if (dto.program_name !== undefined) {
      updateFields.push(`program_name = $${index++}`);
      values.push(dto.program_name);
    }

    if (dto.program_type !== undefined) {
      updateFields.push(`program_type = $${index++}`);
      values.push(dto.program_type);
    }

    if (dto.parent_id !== undefined) {
      updateFields.push(`parent_id = $${index++}`);
      values.push(dto.parent_id);
    }

    if (dto.remark !== undefined) {
      updateFields.push(`remark = $${index++}`);
      values.push(dto.remark);
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
      const query = `UPDATE program SET ${updateFields.join(', ')} WHERE program_id = $${index} RETURNING *`;
      const result = await this.dataSource.query(query, values);

      return result[0];

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('Cannot add duplicate program');
      }
      console.error('Error updating program:', error);
      throw new InternalServerErrorException('Error updating program');
    }
  }

  /**
   * Delete a program by ID
   */
  async delete(id: number) {
    // Check if program exists
    const existingProgram = await this.programRepo.findOne({
      where: { program_id: id }
    });

    if (!existingProgram) {
      throw new NotFoundException('Program not found');
    }

    try {
      await this.programRepo.delete({ program_id: id });
      return existingProgram;

    } catch (error) {
      console.error('Error deleting program:', error);
      throw new InternalServerErrorException('Error deleting program');
    }
  }

  // ========== User Sys Program Normalize Methods ==========

  /**
   * Create user_sys_program_normalize record
   */
  async createUserSysNormalize(dto: CreateProgramUserSysDto) {
    if (!dto.program_id || !dto.user_sys_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newNorm = this.userSysProgramNormRepo.create({
        program_id: dto.program_id,
        user_sys_id: dto.user_sys_id,
        flag_valid: true,
      });

      const savedNorm = await this.userSysProgramNormRepo.save(newNorm);
      return savedNorm;

    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException('This user is already assigned to this program');
      }
      console.error('Error creating program user sys:', error);
      throw new InternalServerErrorException('Error creating program user sys');
    }
  }

  /**
   * Update user_sys_program_normalize record
   */
  async updateUserSysNormalize(dto: UpdateProgramUserSysDto) {
    if (!dto.user_sys_id) {
      throw new BadRequestException('Missing user_sys_id!');
    }

    // Build update fields
    const updateFields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.program_id !== undefined) {
      updateFields.push(`program_id = $${index++}`);
      values.push(dto.program_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      updateFields.push(`flag_valid = $${index++}`);
      values.push(dto.flag_valid);
    }

    if (updateFields.length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    values.push(dto.user_sys_id);

    try {
      const query = `UPDATE user_sys_program_normalize SET ${updateFields.join(', ')} WHERE user_sys_id = $${index} RETURNING *`;
      const result = await this.dataSource.query(query, values);

      if (result.length === 0) {
        throw new NotFoundException('User sys program normalize record not found');
      }

      return result[0];

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error updating program user sys:', error);
      throw new InternalServerErrorException('Error updating program user sys');
    }
  }

  /**
   * Delete user_sys_program_normalize record
   */
  async deleteUserSysNormalize(dto: DeleteProgramUserSysDto) {
    if (!dto.program_id || !dto.user_sys_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const query = `DELETE FROM user_sys_program_normalize WHERE program_id = $1 AND user_sys_id = $2 RETURNING *`;
      const result = await this.dataSource.query(query, [dto.program_id, dto.user_sys_id]);

      if (result.length === 0) {
        throw new NotFoundException('User sys program normalize record not found');
      }

      return result[0];

    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Error deleting program user sys:', error);
      throw new InternalServerErrorException('Error deleting program user sys');
    }
  }

  /**
   * Internal function to create user_sys_program_normalize record
   * Used by other services
   */
  async createUserSysNormalizeInternal(user_sys_id: number, program_id: number) {
    if (!user_sys_id || !program_id) {
      throw new BadRequestException('Missing required fields!');
    }

    try {
      const newNorm = this.userSysProgramNormRepo.create({
        program_id,
        user_sys_id,
        flag_valid: true,
      });
      
      const savedNorm = await this.userSysProgramNormRepo.save(newNorm);
      return savedNorm;
    } catch (error) {
      console.error('Error creating program user sys internally:', error);
      throw error;
    }
  }
}
