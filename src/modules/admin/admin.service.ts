// admin.service.ts
import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Admin } from './entities/admin.entity';
import {
  CreateAdminDto,
  SearchAdminDto,
  UpdateAdminDto,
  LoginAdminDto,
} from './dto/admin.dto';
import {
  hashPassword,
  verifyPassword,
  generateJwtToken,
} from 'src/common/utils/auth.util';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private adminRepo: Repository<Admin>,
    private dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  async searchAdmin(dto: SearchAdminDto) {
    const query = this.adminRepo
      .createQueryBuilder('a')
      .select([
        'a.admin_id',
        'a.username',
        'a.flag_valid',
        'a.created_at',
        'a.updated_at',
      ])
      .addSelect('COUNT(*) OVER()', 'total_count');

    if (dto.username)
      query.andWhere('a.username = :username', { username: dto.username });

    if (typeof dto.flag_valid === 'boolean') {
      query.andWhere('a.flag_valid = :flagValid', {
        flagValid: dto.flag_valid,
      });
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query.orderBy(`a.${dto.sort_by}`, order);
    }

    // Pagination
    if (dto.limit) query.limit(dto.limit);
    if (dto.offset) query.offset(dto.offset);

    try {
      const result = await query.getRawMany();
      return { success: true, data: result };
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async createAdmin(dto: CreateAdminDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingAdmin = await queryRunner.manager.findOne(Admin, {
        where: { username: dto.username },
      });

      if (existingAdmin) {
        throw new ConflictException('Username already exists!');
      }

      const hashedPassword = await hashPassword(dto.password);

      const newAdmin = queryRunner.manager.create(Admin, {
        username: dto.username,
        password: hashedPassword,
        flag_valid: dto.flag_valid ?? true,
      });

      const savedAdmin = await queryRunner.manager.save(newAdmin);

      await queryRunner.commitTransaction();

      const { password: _password, ...result } = savedAdmin;
      return {
        success: true,
        message: 'Admin created successfully!',
        data: result,
      };
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();

      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505'
      ) {
        throw new ConflictException('Username already exists!');
      }

      this.logger.error('Error creating admin:', 'Create Admin', error);
      throw new InternalServerErrorException('Error creating admin');
    } finally {
      await queryRunner.release();
    }
  }

  async updateAdmin(id: number, dto: UpdateAdminDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(Admin, {
        where: { admin_id: id },
      });

      if (!existing) {
        throw new NotFoundException('Admin not found');
      }

      const fieldsToUpdate: Partial<Admin> = {};

      if (dto.username !== undefined) {
        fieldsToUpdate.username = dto.username;
      }
      if (dto.password !== undefined) {
        fieldsToUpdate.password = await hashPassword(dto.password);
      }
      if (dto.flag_valid !== undefined) {
        fieldsToUpdate.flag_valid = dto.flag_valid;
      }

      if (Object.keys(fieldsToUpdate).length === 0) {
        throw new BadRequestException('No fields to update!');
      }

      await queryRunner.manager.update(Admin, { admin_id: id }, fieldsToUpdate);

      // Commit Transaction
      await queryRunner.commitTransaction();

      const updatedAdmin = await this.adminRepo.findOne({
        where: { admin_id: id },
      });
      if (!updatedAdmin) {
        throw new NotFoundException('Admin not found after update');
      }
      const { password: _password, ...result } = updatedAdmin;
      return {
        success: true,
        message: 'Admin updated successfully!',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Error updating admin:', 'Update Admin', error);
      throw new InternalServerErrorException('Error updating admin');
    } finally {
      await queryRunner.release();
    }
  }

  async deleteAdmin(id: number) {
    const existing = await this.adminRepo.findOne({
      where: { admin_id: id },
    });

    if (!existing) {
      throw new NotFoundException('Admin not found');
    }

    try {
      await this.adminRepo.delete({ admin_id: id });
      return { success: true, message: 'Admin deleted successfully!' };
    } catch (error) {
      this.logger.error('Error deleting admin:', 'Delete Admin', error);
      throw new InternalServerErrorException('Error deleting admin');
    }
  }

  async loginAdmin(dto: LoginAdminDto) {
    if (!dto.username || !dto.password) {
      throw new BadRequestException('Username and password are required!');
    }

    try {
      const admin = await this.adminRepo.findOne({
        where: {
          username: dto.username,
          flag_valid: true,
        },
      });

      if (!admin) {
        throw new UnauthorizedException('Invalid credentials!');
      }

      const isMatch = await verifyPassword(dto.password, admin.password);

      if (!isMatch) {
        throw new UnauthorizedException('Incorrect password');
      }

      const { password: _password, ...adminData } = admin;

      const token = generateJwtToken({ admin: adminData });

      return {
        success: true,
        message: 'Login successful',
        token,
        admin: adminData,
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Error logging in admin:', 'Login Admin', error);
      throw new InternalServerErrorException('Error logging in admin');
    }
  }
}
