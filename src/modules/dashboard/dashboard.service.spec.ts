import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DashboardService } from './dashboard.service';
import { Dashboard } from './entities/dashboard.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

const mockDashboard = (overrides: Partial<Dashboard> = {}): Dashboard =>
  ({
    dashboard_id: 1,
    user_sys_id: 11,
    role_type: 'TEACHER',
    report_month: '2026-03',
    payload: { assets: {} },
    created_at: new Date('2026-03-01T00:00:00.000Z'),
    flag_valid: true,
    ...overrides,
  }) as Dashboard;

const mockQb = {
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
  getRawMany: jest.fn(),
};

describe('DashboardService', () => {
  let service: DashboardService;

  const mockDashboardRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLogger: Partial<AppLogger> = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Dashboard), useValue: mockDashboardRepo },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);

    jest.clearAllMocks();
    mockDashboardRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.andWhere.mockReturnThis();
    mockQb.select.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQb.addOrderBy.mockReturnThis();
  });

  describe('searchDashboard', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.searchDashboard({})).rejects.toThrow(BadRequestException);
    });

    it('should filter by role_type = TEACHER', async () => {
      mockQb.getMany.mockResolvedValue([mockDashboard()]);

      const result = await service.searchDashboard({ role_type: 'TEACHER' });

      expect(result).toEqual({ success: true, data: [mockDashboard()] });
      expect(mockDashboardRepo.createQueryBuilder).toHaveBeenCalledWith('md');
      expect(mockQb.andWhere).toHaveBeenCalledWith('md.role_type = :roleType', {
        roleType: 'TEACHER',
      });
    });

    it('should filter by role_type = STUDENT', async () => {
      mockQb.getMany.mockResolvedValue([
        mockDashboard({ role_type: 'STUDENT', user_sys_id: 22 }),
      ]);

      await service.searchDashboard({ role_type: 'STUDENT' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('md.role_type = :roleType', {
        roleType: 'STUDENT',
      });
    });

    it('should apply all provided filters and default ordering', async () => {
      mockQb.getMany.mockResolvedValue([]);

      await service.searchDashboard({
        dashboard_id: 3,
        user_sys_id: 12,
        role_type: 'TEACHER',
        report_month: '2026-02',
        flag_valid: true,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('md.dashboard_id = :dashboardId', {
        dashboardId: 3,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('md.user_sys_id = :userSysId', {
        userSysId: 12,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('md.report_month = :reportMonth', {
        reportMonth: '2026-02',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('md.flag_valid = :flagValid', {
        flagValid: true,
      });
      expect(mockQb.orderBy).toHaveBeenCalledWith('md.report_month', 'DESC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('md.created_at', 'DESC');
    });

    it('should throw InternalServerErrorException when query fails', async () => {
      mockQb.getMany.mockRejectedValue(new Error('DB error'));

      await expect(service.searchDashboard({ role_type: 'TEACHER' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findById', () => {
    it('should return dashboard when found', async () => {
      const row = mockDashboard();
      mockDashboardRepo.findOne.mockResolvedValue(row);

      const result = await service.findById(1);

      expect(result).toEqual({ success: true, data: row });
      expect(mockDashboardRepo.findOne).toHaveBeenCalledWith({
        where: { dashboard_id: 1 },
      });
    });

    it('should throw NotFoundException when dashboard does not exist', async () => {
      mockDashboardRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReportMonths', () => {
    it('should return distinct report months in descending order', async () => {
      mockQb.getRawMany.mockResolvedValue([
        { report_month: '2026-03' },
        { report_month: '2026-02' },
      ]);

      const result = await service.getReportMonths({});

      expect(result).toEqual({ success: true, data: ['2026-03', '2026-02'] });
      expect(mockDashboardRepo.createQueryBuilder).toHaveBeenCalledWith('md');
      expect(mockQb.select).toHaveBeenCalledWith('DISTINCT md.report_month', 'report_month');
      expect(mockQb.orderBy).toHaveBeenCalledWith('md.report_month', 'DESC');
      expect(mockQb.andWhere).not.toHaveBeenCalledWith('md.user_sys_id = :userSysId', {
        userSysId: expect.any(Number),
      });
    });

    it('should apply user_sys_id filter when provided', async () => {
      mockQb.getRawMany.mockResolvedValue([{ report_month: '2026-01' }]);

      await service.getReportMonths({ user_sys_id: 11 });

      expect(mockQb.andWhere).toHaveBeenCalledWith('md.user_sys_id = :userSysId', {
        userSysId: 11,
      });
    });

    it('should throw InternalServerErrorException when query fails', async () => {
      mockQb.getRawMany.mockRejectedValue(new Error('DB error'));

      await expect(service.getReportMonths({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
