// users.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserSys } from './entities/user-sys.entity';
import {
  SearchUserSysDto,
  CreateUserSysDto,
  UpdateUserSysDto,
} from './dto/users.dto';
import { LearningAreaService } from '../learning-area/learning-area.service';
import { ProgramService } from '../program/program.service';
import {
  generateInitialPassword,
  hashPassword,
} from '../../common/utils/auth.util';
import { sendInitialPasswordEmail } from '../../common/utils/mailer.utils';
import { UserSysFields } from 'src/common/interface/user.interface';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserSys)
    private userSysRepo: Repository<UserSys>,
    private dataSource: DataSource,
    private learningAreaService: LearningAreaService,
    private programService: ProgramService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Find user by ID
   */
  async findById(id: number) {
    const user = await this.userSysRepo.findOne({
      where: { user_sys_id: id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Exclude password from response
    const { password: _password, ...result } = user;
    return { success: true, data: result };
  }

  /**
   * Search users with filters, pagination, and conditional JOINs based on role
   * - role_id 4,5: JOIN with learning_area
   * - role_id 2,3: JOIN with program and edu_level
   */
  async search(dto: SearchUserSysDto) {
    // Validate that at least one search parameter is provided
    const hasInput =
      dto.user_sys_id ||
      dto.email ||
      dto.first_name ||
      dto.middle_name ||
      dto.last_name ||
      dto.phone ||
      dto.role_id ||
      dto.code ||
      dto.edu_lev_id ||
      dto.inst_id ||
      dto.keyword ||
      dto.user_status ||
      typeof dto.flag_valid === 'boolean';

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    let query = `
      SELECT *, COUNT(*) OVER() as total_count 
      FROM user_sys u
      LEFT JOIN role r ON u.role_id = r.role_id
    `;

    // Conditional JOINs based on role_id
    if (dto.role_id === 4 || dto.role_id === 5) {
      // Teacher/Educator roles - join with learning_area
      query += `
        LEFT JOIN user_sys_learning_area_normalize uslan ON u.user_sys_id = uslan.user_sys_id
        LEFT JOIN learning_area la ON uslan.learning_area_id = la.learning_area_id
      `;
    } else if (dto.role_id === 2 || dto.role_id === 3) {
      // Student roles - join with program and edu_level
      query += `
        LEFT JOIN user_sys_program_normalize uspn ON u.user_sys_id = uspn.user_sys_id
        LEFT JOIN program p ON uspn.program_id = p.program_id AND p.tree_type = 'leaf'
        LEFT JOIN edu_level el ON u.edu_lev_id = el.edu_lev_id
      `;
    }

    query += ` WHERE 1=1 `;

    const values: any[] = [];
    let index = 1;

    if (dto.user_sys_id) {
      query += ` AND u.user_sys_id = $${index++}`;
      values.push(dto.user_sys_id);
    }

    if (dto.email) {
      query += ` AND u.email = $${index++}`;
      values.push(dto.email);
    }

    if (dto.first_name) {
      query += ` AND u.first_name = $${index++}`;
      values.push(dto.first_name);
    }

    if (dto.middle_name) {
      query += ` AND u.middle_name = $${index++}`;
      values.push(dto.middle_name);
    }

    if (dto.last_name) {
      query += ` AND u.last_name = $${index++}`;
      values.push(dto.last_name);
    }

    if (dto.phone) {
      query += ` AND u.phone = $${index++}`;
      values.push(dto.phone);
    }

    if (dto.role_id) {
      query += ` AND u.role_id = $${index++}`;
      values.push(dto.role_id);
    }

    if (dto.code) {
      query += ` AND u.code = $${index++}`;
      values.push(dto.code);
    }

    if (dto.edu_lev_id) {
      query += ` AND u.edu_lev_id = $${index++}`;
      values.push(dto.edu_lev_id);
    }

    if (dto.inst_id) {
      query += ` AND u.inst_id = $${index++}`;
      values.push(dto.inst_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      query += ` AND u.flag_valid = $${index++}`;
      values.push(dto.flag_valid);
    }

    if (dto.user_status) {
      query += ` AND u.user_status = $${index++}`;
      values.push(dto.user_status);
    }

    if (dto.role_id === 4 || dto.role_id === 5) {
      if (dto.learning_area_id) {
        query += ` AND la.learning_area_id = $${index++}`;
        values.push(dto.learning_area_id);
      }
    } else if (dto.role_id === 2 || dto.role_id === 3) {
      if (dto.program_id) {
        query += ` AND p.program_id = $${index++}`;
        values.push(dto.program_id);
      }
    }
    // Keyword search with ILIKE for case-insensitive partial match
    if (dto.keyword) {
      query += ` AND (u.code ILIKE $${index} OR u.first_name ILIKE $${index} OR u.last_name ILIKE $${index} OR u.email ILIKE $${index})`;
      values.push(`%${dto.keyword}%`);
      index++;
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY u.${dto.sort_by} ${order}`;
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
      const result: UserSysFields[] = await this.dataSource.query(
        query,
        values,
      );
      // Remove password from results
      return result.map((user: any) => {
        const { password: _password, ...rest } = user;
        return rest as UserSysFields;
      });
    } catch (error: unknown) {
      this.logger.error('Error fetching users:', 'SearchUser', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Create a new user with auto-generated password and email notification
   * Also creates learning_area or program normalize record based on input
   */
  async create(dto: CreateUserSysDto) {
    if (
      !dto.email ||
      !dto.first_name ||
      !dto.last_name ||
      !dto.role_id ||
      !dto.code ||
      !dto.inst_id
    ) {
      throw new BadRequestException(
        'Missing required fields: email, first_name, last_name, role_id, code, inst_id',
      );
    }

    // Check if email already exists
    const existingUser = await this.userSysRepo.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('This email is already in use');
    }

    // Generate initial password and hash it
    const initialPassword: string = generateInitialPassword();
    const hashedPassword: string = await hashPassword(initialPassword);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Insert user
      const insertQuery = `
        INSERT INTO user_sys 
        (email, password, first_name, middle_name, last_name, phone, role_id, code, edu_lev_id, inst_id, user_status, profile_pic, flag_valid, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING *
      `;

      const values = [
        dto.email,
        hashedPassword,
        dto.first_name,
        dto.middle_name || null,
        dto.last_name,
        dto.phone || null,
        dto.role_id,
        dto.code || null,
        dto.edu_lev_id || null,
        dto.inst_id || null,
        dto.user_status || null,
        dto.profile_pic || null,
        true,
      ];

      const result: UserSysFields[] = await queryRunner.query(
        insertQuery,
        values,
      );

      if (result.length === 0) {
        throw new InternalServerErrorException('Failed to create user');
      }

      const newUser = result[0];

      // Create learning_area or program normalize record if provided
      if (dto.learning_area_id) {
        await queryRunner.query(
          `INSERT INTO user_sys_learning_area_normalize (user_sys_id, learning_area_id, flag_valid) VALUES ($1, $2, $3)`,
          [newUser.user_sys_id, dto.learning_area_id, true],
        );
      } else if (dto.program_id) {
        await queryRunner.query(
          `INSERT INTO user_sys_program_normalize (user_sys_id, program_id, flag_valid) VALUES ($1, $2, $3)`,
          [newUser.user_sys_id, dto.program_id, true],
        );
      }

      await queryRunner.commitTransaction();

      // Send initial password email (async, don't wait)
      sendInitialPasswordEmail(dto.email, initialPassword).catch((err) => {
        this.logger.error(
          'Error sending initial password email:',
          'CreateUser',
          err,
        );
      });

      return {
        success: true,
        data: newUser.user_sys_id,
        message: 'User created successfully',
      };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      ) {
        throw new ConflictException('This email or code is already in use');
      }
      this.logger.error('Error creating user:', 'CreateUser', error);
      throw new InternalServerErrorException('Server Error');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update an existing user
   */
  async update(id: number, dto: UpdateUserSysDto) {
    // Check if user exists
    const existingUser = await this.userSysRepo.findOne({
      where: { user_sys_id: id },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    // Build update fields
    const updateFields: string[] = [];
    const values: any[] = [];
    let index = 1;

    if (dto.email !== undefined) {
      updateFields.push(`email = $${index++}`);
      values.push(dto.email);
    }

    if (dto.first_name !== undefined) {
      updateFields.push(`first_name = $${index++}`);
      values.push(dto.first_name);
    }

    if (dto.middle_name !== undefined) {
      updateFields.push(`middle_name = $${index++}`);
      values.push(dto.middle_name);
    }

    if (dto.last_name !== undefined) {
      updateFields.push(`last_name = $${index++}`);
      values.push(dto.last_name);
    }

    if (dto.phone !== undefined) {
      updateFields.push(`phone = $${index++}`);
      values.push(dto.phone);
    }

    if (dto.role_id !== undefined) {
      updateFields.push(`role_id = $${index++}`);
      values.push(dto.role_id);
    }

    if (dto.code !== undefined) {
      updateFields.push(`code = $${index++}`);
      values.push(dto.code);
    }

    if (dto.edu_lev_id !== undefined) {
      updateFields.push(`edu_lev_id = $${index++}`);
      values.push(dto.edu_lev_id);
    }

    if (dto.inst_id !== undefined) {
      updateFields.push(`inst_id = $${index++}`);
      values.push(dto.inst_id);
    }

    if (typeof dto.flag_valid === 'boolean') {
      updateFields.push(`flag_valid = $${index++}`);
      values.push(dto.flag_valid);
    }

    if (dto.user_status !== undefined) {
      updateFields.push(`user_status = $${index++}`);
      values.push(dto.user_status);
    }

    if (dto.profile_pic !== undefined) {
      updateFields.push(`profile_pic = $${index++}`);
      values.push(dto.profile_pic);
    }

    // Check if there are any fields to update (including learning_area_id which updates normalize table)
    if (
      updateFields.length === 0 &&
      dto.learning_area_id === undefined &&
      dto.program_id === undefined
    ) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      let userData: UserSysFields;

      // Update user_sys table if there are fields to update
      if (updateFields.length > 0) {
        // Add updated_at
        updateFields.push(`updated_at = NOW()`);
        values.push(id);

        const query = `UPDATE user_sys SET ${updateFields.join(', ')} WHERE user_sys_id = $${index} RETURNING *`;
        const result = await this.dataSource.query(query, values);

        // Remove password from response
        const { password: _password, ...rest } = result[0];
        userData = rest as UserSysFields;
      } else {
        // If no user fields to update, just get existing user data
        const { password: _password, ...rest } = existingUser;
        userData = rest as UserSysFields;
      }

      // Update learning_area_normalize if learning_area_id is provided
      if (dto.learning_area_id !== undefined) {
        await this.learningAreaService.updateUserSysNormalize({
          user_sys_id: id,
          learning_area_id: dto.learning_area_id,
        });
      }

      // Update program_normalize if program_id is provided
      if (dto.program_id !== undefined) {
        await this.programService.updateUserSysNormalize({
          user_sys_id: id,
          program_id: dto.program_id,
        });
      }

      return {
        success: true,
        data: userData,
        message: 'User updated successfully',
      };
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as any).code === '23505'
      ) {
        throw new ConflictException('This email or code is already in use');
      }
      this.logger.error('Error updating user:', 'UpdateUser', error);
      throw new InternalServerErrorException('Server Error');
    }
  }

  /**
   * Delete a user by ID
   */
  async delete(id: number) {
    // Check if user exists
    const existingUser = await this.userSysRepo.findOne({
      where: { user_sys_id: id },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    try {
      await this.userSysRepo.delete({ user_sys_id: id });
      const { password: _password, ...userData } = existingUser;
      return {
        success: true,
        data: userData,
        message: 'User deleted successfully',
      };
    } catch (error: unknown) {
      this.logger.error('Error deleting user:', 'DeleteUser', error);
      throw new InternalServerErrorException('Error deleting user');
    }
  }
}
