// admin.service.ts
import { Injectable, BadRequestException, ConflictException, InternalServerErrorException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Admin } from './entities/admin.entity';
import { CreateAdminDto, SearchAdminDto, UpdateAdminDto, LoginAdminDto } from './dto/admin.dto';
import { hashPassword, verifyPassword, generateJwtToken } from 'src/common/utils/auth.util';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Admin)
    private adminRepo: Repository<Admin>,
    private dataSource: DataSource,
  ) {}

  async searchAdmin(dto: SearchAdminDto) {
    const query = this.adminRepo.createQueryBuilder('a')
      .select([
        'a.admin_id',
        'a.username',
        'a.flag_valid',
        'a.created_at',
        'a.updated_at',
      ])
      .addSelect('COUNT(*) OVER()', 'total_count');

    if (dto.username) query.andWhere('a.username = :username', { username: dto.username });
    
    // Check Boolean แบบระวัง null
    if (typeof dto.flag_valid === 'boolean') {
      query.andWhere('a.flag_valid = :flagValid', { flagValid: dto.flag_valid });
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
      return result;
    } catch (err) {
      throw new InternalServerErrorException(err);
    }
  }

  async createAdmin(dto: CreateAdminDto) {
    // ใช้ Transaction เพื่อความปลอดภัยในการสร้าง Admin
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // เช็คว่า username มีอยู่แล้วหรือไม่
      const existingAdmin = await queryRunner.manager.findOne(Admin, {
        where: { username: dto.username }
      });

      if (existingAdmin) {
        throw new ConflictException('Username already exists!');
      }

      // Hash password
      const hashedPassword = await hashPassword(dto.password);

      // สร้าง Object เตรียม save
      const newAdmin = queryRunner.manager.create(Admin, {
        username: dto.username,
        password: hashedPassword,
        flag_valid: dto.flag_valid ?? true,
      });

      const savedAdmin = await queryRunner.manager.save(newAdmin);

      // Commit Transaction
      await queryRunner.commitTransaction();

      // ไม่ส่ง password กลับ
      const { password, ...result } = savedAdmin;
      return { message: "Admin created successfully!", data: result };

    } catch (error) {
      // Rollback Transaction เมื่อเกิด Error
      await queryRunner.rollbackTransaction();

      if (error instanceof ConflictException) {
        throw error;
      }
      // เช็ค Error Code ของ Postgres (Unique Constraint)
      if (error.code === '23505') {
        throw new ConflictException('Username already exists!');
      }
      console.error('Error creating admin:', error);
      throw new InternalServerErrorException('Error creating admin');
    } finally {
      // Release QueryRunner
      await queryRunner.release();
    }
  }

  async updateAdmin(id: number, dto: UpdateAdminDto) {
    // ใช้ Transaction สำหรับ Update
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // เช็คว่า admin มีอยู่หรือไม่
      const existing = await queryRunner.manager.findOne(Admin, {
        where: { admin_id: id }
      });

      if (!existing) {
        throw new NotFoundException('Admin not found');
      }

      // กรอง field ที่มีค่าเท่านั้น
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

      const updatedAdmin = await this.adminRepo.findOne({ where: { admin_id: id } });
      if (!updatedAdmin) {
        throw new NotFoundException('Admin not found after update');
      }
      const { password, ...result } = updatedAdmin;
      return { message: "Admin updated successfully!", data: result };

    } catch (error) {
      // Rollback Transaction เมื่อเกิด Error
      await queryRunner.rollbackTransaction();

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error updating admin:', error);
      throw new InternalServerErrorException('Error updating admin');
    } finally {
      await queryRunner.release();
    }
  }

  async deleteAdmin(id: number) {
    // เช็คว่า admin มีอยู่หรือไม่
    const existing = await this.adminRepo.findOne({
      where: { admin_id: id }
    });

    if (!existing) {
      throw new NotFoundException('Admin not found');
    }

    try {
      await this.adminRepo.delete({ admin_id: id });
      return { message: "Admin deleted successfully!" };
    } catch (error) {
      console.error('Error deleting admin:', error);
      throw new InternalServerErrorException('Error deleting admin');
    }
  }

  async loginAdmin(dto: LoginAdminDto) {
    if (!dto.username || !dto.password) {
      throw new BadRequestException('Username and password are required!');
    }

    try {
      // ค้นหา admin จาก username และ flag_valid = true
      const admin = await this.adminRepo.findOne({
        where: { 
          username: dto.username,
          flag_valid: true 
        }
      });

      if (!admin) {
        throw new UnauthorizedException('Invalid credentials!');
      }

      // ตรวจสอบ password
      const isMatch = await verifyPassword(dto.password, admin.password);

      if (!isMatch) {
        throw new UnauthorizedException('Incorrect password');
      }

      // สร้าง payload สำหรับ JWT (ไม่รวม password)
      const { password, ...adminData } = admin;

      // Generate JWT Token
      const token = generateJwtToken({ admin: adminData });

      return {
        message: "Login successful",
        token,
        admin: adminData,
      };

    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error logging in admin:', error);
      throw new InternalServerErrorException('Error logging in admin');
    }
  }
}
