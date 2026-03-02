import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { RegisSummaryService } from './regis.summary.service';
import { AppLogger } from '../../../common/logger/app-logger.service';

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RegisSummaryService', () => {
  let service: RegisSummaryService;

  const mockDataSource = {
    query: jest.fn(),
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
        RegisSummaryService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<RegisSummaryService>(RegisSummaryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getInfo ───────────────────────────────────────────────────────────────

  describe('getInfo', () => {
    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(service.getInfo({ inst_id: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return summary info with success', async () => {
      const mockData = {
        academicYear: '3',
        staff: '10',
        building: '2',
        classroom: '20',
      };
      mockDataSource.query.mockResolvedValue([mockData]);

      const result = await service.getInfo({ inst_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [1],
      );
    });

    it('should return empty object when query result is empty', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getInfo({ inst_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should query semester, user_sys, building, and room_location counts', async () => {
      mockDataSource.query.mockResolvedValue([{}]);

      await service.getInfo({ inst_id: 1 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('semester');
      expect(queryStr).toContain('user_sys');
      expect(queryStr).toContain('building');
      expect(queryStr).toContain('room_location');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.getInfo({ inst_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getCurriculum ─────────────────────────────────────────────────────────

  describe('getCurriculum', () => {
    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(service.getCurriculum({ inst_id: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return curriculum summary with success', async () => {
      const mockData = {
        learningArea: '5',
        subject: '30',
        curriculum: '4',
      };
      mockDataSource.query.mockResolvedValue([mockData]);

      const result = await service.getCurriculum({ inst_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [1],
      );
    });

    it('should return empty object when query result is empty', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getCurriculum({ inst_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should query learning_area, subject, and program counts', async () => {
      mockDataSource.query.mockResolvedValue([{}]);

      await service.getCurriculum({ inst_id: 1 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('learning_area');
      expect(queryStr).toContain('subject');
      expect(queryStr).toContain('program');
    });

    it('should filter program by tree_type = root', async () => {
      mockDataSource.query.mockResolvedValue([{}]);

      await service.getCurriculum({ inst_id: 1 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain("tree_type = 'root'");
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.getCurriculum({ inst_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getSchedule ───────────────────────────────────────────────────────────

  describe('getSchedule', () => {
    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(
        service.getSchedule({ inst_id: 0, semester_id: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when semester_id is missing', async () => {
      await expect(
        service.getSchedule({ inst_id: 1, semester_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return schedule summary with success', async () => {
      const mockData = { classroom: '8', sectionSchedule: '25' };
      mockDataSource.query.mockResolvedValue([mockData]);

      const result = await service.getSchedule({ inst_id: 1, semester_id: 2 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 2],
      );
    });

    it('should return empty object when query result is empty', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getSchedule({ inst_id: 1, semester_id: 2 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should query program (leaf) and section counts filtered by semester', async () => {
      mockDataSource.query.mockResolvedValue([{}]);

      await service.getSchedule({ inst_id: 1, semester_id: 2 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain("tree_type = 'leaf'");
      expect(queryStr).toContain('section');
      expect(queryStr).toContain('semester_id');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.getSchedule({ inst_id: 1, semester_id: 2 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── getRegistration ───────────────────────────────────────────────────────

  describe('getRegistration', () => {
    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(service.getRegistration({ inst_id: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return registration summary with success', async () => {
      const mockData = {
        allStudent: '100',
        activeStudent: '80',
        graduatedStudent: '20',
      };
      mockDataSource.query.mockResolvedValue([mockData]);

      const result = await service.getRegistration({ inst_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [1],
      );
    });

    it('should return empty object when query result is empty', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getRegistration({ inst_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it('should count allStudent, activeStudent, and graduatedStudent', async () => {
      mockDataSource.query.mockResolvedValue([{}]);

      await service.getRegistration({ inst_id: 1 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('allStudent');
      expect(queryStr).toContain('activeStudent');
      expect(queryStr).toContain('graduatedStudent');
    });

    it('should filter user_sys by role_id IN (2, 3)', async () => {
      mockDataSource.query.mockResolvedValue([{}]);

      await service.getRegistration({ inst_id: 1 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('role_id IN (2, 3)');
    });

    it('should count Active and Graduated status separately', async () => {
      mockDataSource.query.mockResolvedValue([{}]);

      await service.getRegistration({ inst_id: 1 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain("'Active'");
      expect(queryStr).toContain("'Graduated'");
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.getRegistration({ inst_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
