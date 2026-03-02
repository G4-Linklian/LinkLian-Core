// role.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto, SearchRoleDto, UpdateRoleDto } from './dto/role.dto';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private readonly logger: AppLogger,
  ) {}

  async findById(id: number) {
    const role = await this.roleRepo.findOne({
      where: { role_id: id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async searchRole(dto: SearchRoleDto) {
    const query = this.roleRepo
      .createQueryBuilder('r')
      .select(['r.*', 'COUNT(*) OVER() AS total_count']);

    if (dto.role_id)
      query.andWhere('r.role_id = :roleId', { roleId: dto.role_id });
    if (dto.role_name)
      query.andWhere('r.role_name = :roleName', { roleName: dto.role_name });
    if (dto.role_type)
      query.andWhere('r.role_type = :roleType', { roleType: dto.role_type });
    if (dto.access)
      query.andWhere('r.access @> :access::jsonb', {
        access: JSON.stringify(dto.access),
      });

    if (typeof dto.flag_valid === 'boolean') {
      query.andWhere('r.flag_valid = :flagValid', {
        flagValid: dto.flag_valid,
      });
    }

    // Sort
    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query.orderBy(`r.${dto.sort_by}`, order);
    }

    // Pagination
    if (dto.limit) query.limit(dto.limit);
    if (dto.offset) query.offset(dto.offset);

    try {
      const result = await query.getRawMany();
      return result;
    } catch (err) {
      this.logger.error('Error searching roles:', 'SearchRole', err);
      throw new InternalServerErrorException(err);
    }
  }

  async createRole(dto: CreateRoleDto) {
    try {
      const newRole = this.roleRepo.create({
        ...dto,
        flag_valid: dto.flag_valid ?? true,
      });

      const savedRole = await this.roleRepo.save(newRole);
      return { message: 'Role created successfully!', data: savedRole };
    } catch (error) {
      this.logger.error('Error creating role:', 'CreateRole', error);
      throw new InternalServerErrorException('Error creating role');
    }
  }

  async updateRole(id: number, dto: UpdateRoleDto) {
    const existing = await this.roleRepo.findOne({
      where: { role_id: id },
    });

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    const fieldsToUpdate: Partial<Role> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && value !== null) {
        fieldsToUpdate[key] = value;
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.roleRepo.update({ role_id: id }, fieldsToUpdate);
      const updatedRole = await this.roleRepo.findOne({
        where: { role_id: id },
      });
      return { message: 'Role updated successfully!', data: updatedRole };
    } catch (error) {
      this.logger.error('Error updating role:', 'UpdateRole', error);
      throw new InternalServerErrorException('Error updating role');
    }
  }

  async deleteRole(id: number) {
    const existing = await this.roleRepo.findOne({
      where: { role_id: id },
    });

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    try {
      await this.roleRepo.delete({ role_id: id });
      return { message: 'Role deleted successfully!' };
    } catch (error) {
      this.logger.error('Error deleting role:', 'DeleteRole', error);
      throw new InternalServerErrorException('Error deleting role');
    }
  }
}
