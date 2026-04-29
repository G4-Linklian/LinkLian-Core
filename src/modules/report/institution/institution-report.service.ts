import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { InstitutionReport } from './entities/institution-report.entity';
import {
  CreateInstitutionReportDto,
  SearchInstitutionReportDto,
  UpdateInstitutionReportDto,
} from './dto/institution-report.dto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

@Injectable()
export class InstitutionReportService {
  constructor(
    @InjectRepository(InstitutionReport)
    private institutionReportRepo: Repository<InstitutionReport>,
    private readonly logger: AppLogger,
  ) {}

  async findById(id: number) {
    const report = await this.institutionReportRepo
      .createQueryBuilder('ir')
      .select([
        'ir.*',
        'i.inst_name_th as inst_name_th',
        'i.inst_name_en as inst_name_en',
        'u.first_name as reporter_first_name',
        'u.last_name as reporter_last_name',
        'u.email as reporter_email',
      ])
      .leftJoin('institution', 'i', 'i.inst_id = ir.inst_id')
      .leftJoin('user_sys', 'u', 'u.user_sys_id = ir.reporter_id')
      .where('ir.inst_report_id = :id', { id })
      .getRawOne();

    if (!report) {
      throw new NotFoundException('Institution report not found');
    }

    return { success: true, data: report };
  }

  async searchInstitutionReport(dto: SearchInstitutionReportDto) {
    const query = this.institutionReportRepo
      .createQueryBuilder('ir')
      .select([
        'ir.*',
        'i.inst_name_th as inst_name_th',
        'i.inst_name_en as inst_name_en',
        'u.first_name as reporter_first_name',
        'u.last_name as reporter_last_name',
        'u.email as reporter_email',
        'r.role_name as reporter_role_name',
        'COUNT(*) OVER() AS total_count',
      ])
      .leftJoin('institution', 'i', 'i.inst_id = ir.inst_id')
      .leftJoin('user_sys', 'u', 'u.user_sys_id = ir.reporter_id')
      .leftJoin('role', 'r', 'r.role_id = u.role_id');

    if (dto.inst_report_id) {
      query.andWhere('ir.inst_report_id = :instReportId', {
        instReportId: dto.inst_report_id,
      });
    }

    if (dto.inst_id) {
      query.andWhere('ir.inst_id = :instId', { instId: dto.inst_id });
    }

    if (dto.reporter_id) {
      query.andWhere('ir.reporter_id = :reporterId', {
        reporterId: dto.reporter_id,
      });
    }

    if (typeof dto.mark_resolved === 'boolean') {
      query.andWhere('ir.mark_resolved = :markResolved', {
        markResolved: dto.mark_resolved,
      });
    }

    if (typeof dto.flag_valid === 'boolean') {
      query.andWhere('ir.flag_valid = :flagValid', {
        flagValid: dto.flag_valid,
      });
    }

    if (dto.keyword) {
      const keyword = `%${dto.keyword.trim()}%`;
      query.andWhere(
        new Brackets((qb) => {
          qb.where('CAST(ir.inst_report_id AS TEXT) ILIKE :keyword', { keyword })
            .orWhere('ir.title ILIKE :keyword', { keyword })
            .orWhere('u.first_name ILIKE :keyword', { keyword })
            .orWhere('u.last_name ILIKE :keyword', { keyword })
            .orWhere('u.email ILIKE :keyword', { keyword })
        }),
      );
    }

    if (dto.sort_by) {
      const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query.orderBy(`ir.${dto.sort_by}`, order);
    }

    if (dto.limit) query.limit(dto.limit);
    if (dto.offset) query.offset(dto.offset);

    try {
      const result = await query.getRawMany();
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(
        'Error searching institution reports:',
        'SearchInstitutionReport',
        error,
      );
      throw new InternalServerErrorException('Error searching institution reports');
    }
  }

  async createInstitutionReport(dto: CreateInstitutionReportDto) {
    this.logger.debug('Creating institution report with DTO:', 'CreateInstitutionReport', dto);
    try {
      const newReport = this.institutionReportRepo.create({
        ...dto,
        report_date: dto.report_date ? new Date(dto.report_date) : new Date(),
        flag_valid: dto.flag_valid ?? true,
        mark_resolved: dto.mark_resolved ?? false,
      });

      this.logger.debug('Creating institution report with data:', 'CreateInstitutionReport', newReport);

      const savedReport = await this.institutionReportRepo.save(newReport);
      return {
        success: true,
        message: 'Institution report created successfully!',
        data: savedReport,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23502' &&
        'column' in error &&
        (error as { column?: unknown }).column === 'inst_report_id'
      ) {
        throw new InternalServerErrorException(
          'Database schema issue: inst_report_id has no default sequence. Please run db/fixes/20260412_fix_report_pk_sequences.sql',
        );
      }
      this.logger.error(
        'Error creating institution report:',
        'CreateInstitutionReport',
        error,
      );
      throw new InternalServerErrorException('Error creating institution report');
    }
  }

  async updateInstitutionReport(id: number, dto: UpdateInstitutionReportDto) {
    const existing = await this.institutionReportRepo.findOne({
      where: { inst_report_id: id },
    });

    if (!existing) {
      throw new NotFoundException('Institution report not found');
    }

    const fieldsToUpdate: QueryDeepPartialEntity<InstitutionReport> = {};

    if (dto.inst_id !== undefined) fieldsToUpdate.inst_id = dto.inst_id;
    if (dto.reporter_id !== undefined)
      fieldsToUpdate.reporter_id = dto.reporter_id;
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
      await this.institutionReportRepo.update({ inst_report_id: id }, fieldsToUpdate);
      const updatedReport = await this.institutionReportRepo.findOne({
        where: { inst_report_id: id },
      });

      return {
        success: true,
        message: 'Institution report updated successfully!',
        data: updatedReport,
      };
    } catch (error) {
      this.logger.error(
        'Error updating institution report:',
        'UpdateInstitutionReport',
        error,
      );
      throw new InternalServerErrorException('Error updating institution report');
    }
  }

  async deleteInstitutionReport(id: number) {
    const existing = await this.institutionReportRepo.findOne({
      where: { inst_report_id: id },
    });

    if (!existing) {
      throw new NotFoundException('Institution report not found');
    }

    try {
      await this.institutionReportRepo.delete({ inst_report_id: id });
      return { success: true, message: 'Institution report deleted successfully!' };
    } catch (error) {
      this.logger.error(
        'Error deleting institution report:',
        'DeleteInstitutionReport',
        error,
      );
      throw new InternalServerErrorException('Error deleting institution report');
    }
  }
}
