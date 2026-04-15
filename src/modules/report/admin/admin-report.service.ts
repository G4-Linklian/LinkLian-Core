import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { AdminReport } from './entities/admin-report.entity';
import {
  CreateAdminReportDto,
  SearchAdminReportDto,
  UpdateAdminReportDto,
} from './dto/admin-report.dto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class AdminReportService {
  constructor(
    @InjectRepository(AdminReport)
    private adminReportRepo: Repository<AdminReport>,
    private readonly logger: AppLogger,
  ) {}

  async findById(id: number) {
    const report = await this.adminReportRepo
      .createQueryBuilder('ar')
      .select([
        'ar.*',
        'i.inst_name_th as inst_name_th',
        'i.inst_name_en as inst_name_en',
      ])
      .leftJoin('institution', 'i', 'i.inst_id = ar.inst_id')
      .where('ar.admin_report_id = :id', { id })
      .getRawOne();

    if (!report) {
      throw new NotFoundException('Admin report not found');
    }

    return { success: true, data: report };
  }

  async searchAdminReport(dto: SearchAdminReportDto) {
    const query = this.adminReportRepo
      .createQueryBuilder('ar')
      .select([
        'ar.*',
        'i.inst_name_th as inst_name_th',
        'i.inst_name_en as inst_name_en',
        'i.inst_type as inst_type',
        'COUNT(*) OVER() AS total_count',
      ])
      .leftJoin('institution', 'i', 'i.inst_id = ar.inst_id');

    if (dto.admin_report_id) {
      query.andWhere('ar.admin_report_id = :adminReportId', {
        adminReportId: dto.admin_report_id,
      });
    }

    if (dto.inst_id) {
      query.andWhere('ar.inst_id = :instId', { instId: dto.inst_id });
    }

    if (typeof dto.mark_resolved === 'boolean') {
      query.andWhere('ar.mark_resolved = :markResolved', {
        markResolved: dto.mark_resolved,
      });
    }

    if (typeof dto.flag_valid === 'boolean') {
      query.andWhere('ar.flag_valid = :flagValid', {
        flagValid: dto.flag_valid,
      });
    }

    if (dto.keyword) {
      const keyword = `%${dto.keyword.trim()}%`;
      query.andWhere(
        new Brackets((qb) => {
          qb.where('CAST(ar.admin_report_id AS TEXT) ILIKE :keyword', { keyword })
            .orWhere('ar.title ILIKE :keyword', { keyword })
            .orWhere('i.inst_name_th ILIKE :keyword', { keyword })
            .orWhere('i.inst_name_en ILIKE :keyword', { keyword });
        }),
      );
    }

    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query.orderBy(`ar.${dto.sort_by}`, order);
    }

    if (dto.limit) query.limit(dto.limit);
    if (dto.offset) query.offset(dto.offset);

    try {
      const result = await query.getRawMany();
      this.logger.debug('SearchAdminReport result:', 'SearchAdminReport', result);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('Error searching admin reports:', 'SearchAdminReport', error);
      throw new InternalServerErrorException('Error searching admin reports');
    }
  }

  async createAdminReport(dto: CreateAdminReportDto) {
    this.logger.debug('Creating admin report with DTO:', 'CreateAdminReport', dto);
    try {
      const newReport = this.adminReportRepo.create({
        ...dto,
        report_date: dto.report_date ? new Date(dto.report_date) : new Date(),
        flag_valid: dto.flag_valid ?? true,
        mark_resolved: dto.mark_resolved ?? false,
      });

      this.logger.debug('Creating admin report with data:', 'CreateAdminReport', newReport);

      const savedReport = await this.adminReportRepo.save(newReport);
      return {
        success: true,
        message: 'Admin report created successfully!',
        data: savedReport,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23502' &&
        'column' in error &&
        (error as { column?: unknown }).column === 'admin_report_id'
      ) {
        throw new InternalServerErrorException(
          'Database schema issue: admin_report_id has no default sequence. Please run db/fixes/20260412_fix_report_pk_sequences.sql',
        );
      }
      this.logger.error('Error creating admin report:', 'CreateAdminReport', error);
      throw new InternalServerErrorException('Error creating admin report');
    }
  }

  async updateAdminReport(id: number, dto: UpdateAdminReportDto) {
    const existing = await this.adminReportRepo.findOne({
      where: { admin_report_id: id },
    });

    if (!existing) {
      throw new NotFoundException('Admin report not found');
    }

    const fieldsToUpdate: QueryDeepPartialEntity<AdminReport> = {};

    if (dto.inst_id !== undefined) fieldsToUpdate.inst_id = dto.inst_id;
    if (dto.title !== undefined) fieldsToUpdate.title = dto.title;
    if (dto.detail !== undefined) fieldsToUpdate.detail = dto.detail;
    if (dto.report_file !== undefined) fieldsToUpdate.report_file = dto.report_file;
    if (dto.flag_valid !== undefined) fieldsToUpdate.flag_valid = dto.flag_valid;
    if (dto.mark_resolved !== undefined)
      fieldsToUpdate.mark_resolved = dto.mark_resolved;
    if (dto.report_date !== undefined)
      fieldsToUpdate.report_date = new Date(dto.report_date);

    if (Object.keys(fieldsToUpdate).length === 0) {
      throw new BadRequestException('No fields to update!');
    }

    try {
      await this.adminReportRepo.update({ admin_report_id: id }, fieldsToUpdate);
      const updatedReport = await this.adminReportRepo.findOne({
        where: { admin_report_id: id },
      });

      return {
        success: true,
        message: 'Admin report updated successfully!',
        data: updatedReport,
      };
    } catch (error) {
      this.logger.error('Error updating admin report:', 'UpdateAdminReport', error);
      throw new InternalServerErrorException('Error updating admin report');
    }
  }

  async deleteAdminReport(id: number) {
    const existing = await this.adminReportRepo.findOne({
      where: { admin_report_id: id },
    });

    if (!existing) {
      throw new NotFoundException('Admin report not found');
    }

    try {
      await this.adminReportRepo.delete({ admin_report_id: id });
      return { success: true, message: 'Admin report deleted successfully!' };
    } catch (error) {
      this.logger.error('Error deleting admin report:', 'DeleteAdminReport', error);
      throw new InternalServerErrorException('Error deleting admin report');
    }
  }
}
