import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppLogger } from '../../../common/logger/app-logger.service';
import { AdminReportService } from './admin-report.service';
import { AdminReport } from './entities/admin-report.entity';

describe('AdminReportService', () => {
  let service: AdminReportService;

  const qb: any = {
    select: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };

  const repoMock: Partial<Repository<AdminReport>> & {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  } = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const loggerMock = {
    debug: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminReportService,
        { provide: getRepositoryToken(AdminReport), useValue: repoMock },
        { provide: AppLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get<AdminReportService>(AdminReportService);
    jest.clearAllMocks();
    repoMock.createQueryBuilder.mockReturnValue(qb);
    qb.select.mockReturnThis();
    qb.leftJoin.mockReturnThis();
    qb.where.mockReturnThis();
    qb.andWhere.mockReturnThis();
    qb.orderBy.mockReturnThis();
    qb.limit.mockReturnThis();
    qb.offset.mockReturnThis();
  });

  describe('findById', () => {
    it('should return report when found', async () => {
      qb.getRawOne.mockResolvedValueOnce({ admin_report_id: 1 });

      const result = await service.findById(1);

      expect(result).toEqual({ success: true, data: { admin_report_id: 1 } });
      expect(repoMock.createQueryBuilder).toHaveBeenCalledWith('ar');
    });

    it('should throw NotFoundException when report not found', async () => {
      qb.getRawOne.mockResolvedValueOnce(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchAdminReport', () => {
    it('should return search data', async () => {
      qb.getRawMany.mockResolvedValueOnce([{ admin_report_id: 1, total_count: 1 }]);

      const result = await service.searchAdminReport({ inst_id: 10 });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(qb.andWhere).toHaveBeenCalledWith('ar.inst_id = :instId', {
        instId: 10,
      });
    });

    it('should throw InternalServerErrorException when query fails', async () => {
      qb.getRawMany.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.searchAdminReport({ inst_id: 10 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createAdminReport', () => {
    it('should create and return report', async () => {
      const dto = {
        inst_id: 10,
        title: 'System issue',
        detail: 'Cannot access dashboard',
      };
      const created = { ...dto, admin_report_id: 1 };

      repoMock.create.mockReturnValueOnce(created);
      repoMock.save.mockResolvedValueOnce(created);

      const result = await service.createAdminReport(dto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(repoMock.save).toHaveBeenCalled();
    });

    it('should throw schema message when admin_report_id has no sequence', async () => {
      repoMock.create.mockReturnValueOnce({});
      repoMock.save.mockRejectedValueOnce({
        code: '23502',
        column: 'admin_report_id',
      });

      await expect(
        service.createAdminReport({
          inst_id: 10,
          title: 'x',
          detail: 'y',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('updateAdminReport', () => {
    it('should throw NotFoundException when report not found', async () => {
      repoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateAdminReport(1, { title: 'updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no field to update', async () => {
      repoMock.findOne.mockResolvedValueOnce({ admin_report_id: 1 });

      await expect(service.updateAdminReport(1, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteAdminReport', () => {
    it('should throw NotFoundException when report not found', async () => {
      repoMock.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteAdminReport(1)).rejects.toThrow(NotFoundException);
    });

    it('should delete report when exists', async () => {
      repoMock.findOne.mockResolvedValueOnce({ admin_report_id: 1 });
      repoMock.delete.mockResolvedValueOnce({});

      const result = await service.deleteAdminReport(1);

      expect(result).toEqual({
        success: true,
        message: 'Admin report deleted successfully!',
      });
    });
  });
});
