import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ImportSectionScheduleService } from './import-section-schedule.service';
import { UserSys } from '../../users/entities/user-sys.entity';
import { Subject } from '../../subject/entities/subject.entity';
import { Section } from '../../section/entities/section.entity';
import { SectionEducator } from '../../section/entities/section-educator.entity';
import { SectionSchedule } from '../../section/entities/section-schedule.entity';
import { Semester } from '../../semester/entities/semester.entity';
import { Building } from '../../building/entities/building.entity';
import { RoomLocation } from '../../room-location/entities/room-location.entity';
import { Institution } from '../../institution/entities/institution.entity';
import { AppLogger } from '../../../common/logger/app-logger.service';

jest.mock('../shared/utils/excel.util', () => ({
  parseExcelFile: jest.fn(),
}));

jest.mock('../shared', () => ({
  calculateDataHash: jest.fn().mockReturnValue('mock-hash'),
  chunkArray: (arr: any[], size: number) => {
    const chunks: any[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  },
  processBatchesParallel: jest.fn().mockImplementation(async (batches: any[], fn: (b: any) => any) => {
    const results: any[] = [];
    for (const batch of batches) {
      const res = await fn(batch);
      results.push(...res);
    }
    return results;
  }),
  createValidationToken: jest.fn().mockReturnValue('mock-section-token'),
  IMPORT_BATCH_SIZE: 100,
  IMPORT_MAX_CONCURRENT_BATCHES: 3,
}));

import { parseExcelFile } from '../shared/utils/excel.util';

const mockParseExcelFile = parseExcelFile as jest.Mock;

const mockRepoFactory = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findBy: jest.fn(),
});

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    query: jest.fn(),
    findOne: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  query: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('signed-token'),
  verify: jest.fn(),
};

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

describe('ImportSectionScheduleService', () => {
  let service: ImportSectionScheduleService;
  let semesterRepo: ReturnType<typeof mockRepoFactory>;
  let buildingRepo: ReturnType<typeof mockRepoFactory>;
  let userRepo: ReturnType<typeof mockRepoFactory>;

  const mockBuffer = Buffer.from('mock-excel');

  const mockRow = {
    'รหัสวิชา': 'MAT001',
    'กลุ่มเรียน': '1',
    'วัน': 'จันทร์',
    'เวลาเริ่มเรียน': '08:00',
    'เวลาสิ้นสุด': '09:00',
    'ตึก': 'อาคาร A',
    'หมายเลขตึก': 'A',
    'ห้องเรียน': '101',
    'รหัสผู้สอนหลัก': 'T001',
  };

  const mockSemester = {
    semester_id: 5,
    inst_id: 1,
    flag_valid: true,
    semester_name: '1/2567',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    semesterRepo = mockRepoFactory();
    semesterRepo.findOne.mockResolvedValue(mockSemester);
    buildingRepo = mockRepoFactory();
    userRepo = mockRepoFactory();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportSectionScheduleService,
        { provide: getRepositoryToken(UserSys), useValue: userRepo },
        { provide: getRepositoryToken(Subject), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Section), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(SectionSchedule), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(SectionEducator), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Institution), useValue: mockRepoFactory() },
        { provide: getRepositoryToken(Semester), useValue: semesterRepo },
        { provide: getRepositoryToken(Building), useValue: buildingRepo },
        { provide: getRepositoryToken(RoomLocation), useValue: mockRepoFactory() },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ImportSectionScheduleService>(ImportSectionScheduleService);
  });

  /**
   * Build mock PreFetchedData returned by preFetchData() (via dataSource.query chain).
   * We intercept the private preFetchData by mocking dataSource.query results.
   */
  // preFetchData Promise.all order:
  // 1. dataSource.query  → subjects
  // 2. buildingRepo.find → buildings  (repo, NOT dataSource.query)
  // 3. dataSource.query  → rooms
  // 4. userRepo.find     → users      (repo, NOT dataSource.query)
  // 5. dataSource.query  → existingSections
  function setupPreFetchMocks(opts?: { existingSections?: any[]; users?: any[] }) {
    mockDataSource.query
      .mockResolvedValueOnce([{ subject_code: 'MAT001', subject_id: 10 }]) // subjects
      .mockResolvedValueOnce([])                                            // rooms
      .mockResolvedValueOnce(opts?.existingSections ?? []);                 // existing sections
    buildingRepo.find.mockResolvedValue([]);
    userRepo.find.mockResolvedValue(opts?.users ?? []);
  }

  describe('validateSectionScheduleData', () => {
    it('should throw NotFoundException if semester not found', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      semesterRepo.findOne.mockResolvedValue(null);

      await expect(
        service.validateSectionScheduleData(1, 5, mockBuffer),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate and return validationToken when no errors', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      semesterRepo.findOne.mockResolvedValue(mockSemester);
      setupPreFetchMocks();

      const result = await service.validateSectionScheduleData(1, 5, mockBuffer);

      expect(mockParseExcelFile).toHaveBeenCalledWith(mockBuffer);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('validatedData');
      expect(result).toHaveProperty('validationToken');
    });

    it('should mark section as duplicate if already exists', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      semesterRepo.findOne.mockResolvedValue(mockSemester);

      setupPreFetchMocks({
        users: [{ user_sys_id: 20, code: 'T001', flag_valid: true }],
        existingSections: [{ subject_code: 'MAT001', section_name: '1' }],
      });

      const result = await service.validateSectionScheduleData(1, 5, mockBuffer);

      expect(result.success).toBe(true);
      expect(result.data.summary.duplicateCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('saveSectionScheduleData', () => {
    it('should throw BadRequestException if validationToken is missing', async () => {
      await expect(
        service.saveSectionScheduleData(1, 5, mockBuffer, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if institution not found', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      mockQueryRunner.manager.findOne.mockResolvedValue(null); // no institution

      await expect(
        service.saveSectionScheduleData(1, 5, mockBuffer, 'mock-token'),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should save section schedules and return success', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);

      // Institution found
      mockQueryRunner.manager.findOne.mockResolvedValue({ inst_id: 1 });

      // preFetchData
      setupPreFetchMocks({
        users: [{ user_sys_id: 20, code: 'T001', flag_valid: true }],
      });

      // saveBatch queries: building insert, room insert, section insert, schedule insert, educator insert
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ building_id: 1 }])     // INSERT building
        .mockResolvedValueOnce([{ room_location_id: 2 }]) // INSERT room
        .mockResolvedValueOnce([{ section_id: 3 }])       // INSERT section
        .mockResolvedValueOnce([])                         // INSERT schedule
        .mockResolvedValueOnce([]);                        // INSERT main educator

      const result = await service.saveSectionScheduleData(1, 5, mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(result.message).toContain('สำเร็จ');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback and rethrow on error', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      mockQueryRunner.manager.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        service.saveSectionScheduleData(1, 5, mockBuffer, 'mock-token'),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
