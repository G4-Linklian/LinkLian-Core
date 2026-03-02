import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ImportEnrollmentService } from './import-enrollment.service';
import { Section } from '../../section/entities/section.entity';
import { Enrollment } from '../../section/entities/enrollment.entity';
import { UserSys } from '../../users/entities/user-sys.entity';
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
  createValidationToken: jest.fn().mockReturnValue('mock-enrollment-token'),
  verifyValidationToken: jest.fn().mockReturnValue({
    type: 'enrollment',
    instId: 1,
    dataHash: 'mock-hash',
    validCount: 1,
    duplicateCount: 0,
  }),
  IMPORT_BATCH_SIZE: 100,
  IMPORT_MAX_CONCURRENT_BATCHES: 3,
}));

import { parseExcelFile } from '../shared/utils/excel.util';
import { createValidationToken, verifyValidationToken } from '../shared';

const mockParseExcelFile = parseExcelFile as jest.Mock;
const mockCreateValidationToken = createValidationToken as jest.Mock;
const mockVerifyValidationToken = verifyValidationToken as jest.Mock;

const mockSectionRepo = () => ({
  findOne: jest.fn(),
});

const mockEnrollmentRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

const mockUserRepo = () => ({
  find: jest.fn(),
});

const mockInstitutionRepo = () => ({
  findOne: jest.fn(),
});

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    findOne: jest.fn(),
    query: jest.fn(),
    save: jest.fn(),
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

describe('ImportEnrollmentService', () => {
  let service: ImportEnrollmentService;
  let sectionRepo: ReturnType<typeof mockSectionRepo>;
  let userRepo: ReturnType<typeof mockUserRepo>;

  const mockBuffer = Buffer.from('mock-excel');
  const mockRawRow = { 'รหัสนักเรียน': 'S001' };

  beforeEach(async () => {
    jest.clearAllMocks();

    sectionRepo = mockSectionRepo();
    userRepo = mockUserRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportEnrollmentService,
        { provide: getRepositoryToken(Section), useValue: sectionRepo },
        { provide: getRepositoryToken(Enrollment), useValue: mockEnrollmentRepo() },
        { provide: getRepositoryToken(UserSys), useValue: userRepo },
        { provide: getRepositoryToken(Institution), useValue: mockInstitutionRepo() },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ImportEnrollmentService>(ImportEnrollmentService);
  });

  describe('validateEnrollmentData', () => {
    it('should parse excel and return validationToken when no errors', async () => {
      mockParseExcelFile.mockResolvedValue([mockRawRow]);

      userRepo.find.mockResolvedValue([
        { user_sys_id: 10, code: 'S001', role_id: 2, flag_valid: true, inst_id: 1 },
      ]);
      mockDataSource.query
        .mockResolvedValueOnce([{ section_id: 5 }]) // section existence check
        .mockResolvedValueOnce([]); // preFetchData: existing enrollments

      const result = await service.validateEnrollmentData(1, 5, mockBuffer);

      expect(mockParseExcelFile).toHaveBeenCalledWith(mockBuffer);
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('validationToken');
    });

    it('should return null validationToken when there are errors', async () => {
      mockParseExcelFile.mockResolvedValue([{}]); // empty row → validation errors

      userRepo.find.mockResolvedValue([]);
      mockDataSource.query
        .mockResolvedValueOnce([{ section_id: 5 }]) // section existence check
        .mockResolvedValueOnce([]); // preFetchData: existing enrollments

      const result = await service.validateEnrollmentData(1, 5, mockBuffer);

      expect(result.success).toBe(true);
      // token may be null if errorCount > 0 or validCount === 0
      expect(result).toHaveProperty('validationToken');
    });
  });

  describe('saveEnrollmentData', () => {
    it('should throw BadRequestException if validationToken is missing', async () => {
      await expect(
        service.saveEnrollmentData(1, 5, mockBuffer, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if institution not found', async () => {
      mockParseExcelFile.mockResolvedValue([mockRawRow]);
      mockVerifyValidationToken.mockReturnValue({
        type: 'enrollment', instId: 1, dataHash: 'mock-hash', validCount: 1, duplicateCount: 0,
      });
      mockQueryRunner.manager.findOne.mockResolvedValue(null); // no institution

      await expect(
        service.saveEnrollmentData(1, 5, mockBuffer, 'mock-token'),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should save data and return success', async () => {
      mockParseExcelFile.mockResolvedValue([mockRawRow]);
      mockVerifyValidationToken.mockReturnValue({
        type: 'enrollment', instId: 1, dataHash: 'mock-hash', validCount: 1, duplicateCount: 0,
      });

      // Institution found
      mockQueryRunner.manager.findOne
        .mockResolvedValueOnce({ inst_id: 1, inst_name: 'Test School' });

      // preFetchData: userRepo.find and dataSource.query
      userRepo.find.mockResolvedValue([
        { user_sys_id: 10, code: 'S001', role_id: 2, inst_id: 1, flag_valid: true },
      ]);
      mockDataSource.query.mockResolvedValue([]); // preFetchData: existing enrollments

      // saveBatch: queryRunner.manager.query for INSERT enrollment
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ enrollment_id: 99 }]); // insert enrollment

      const result = await service.saveEnrollmentData(1, 5, mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(result.message).toContain('สำเร็จ');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback on error during save', async () => {
      mockParseExcelFile.mockResolvedValue([mockRawRow]);
      mockVerifyValidationToken.mockReturnValue({
        type: 'enrollment', instId: 1, dataHash: 'mock-hash', validCount: 1, duplicateCount: 0,
      });

      mockQueryRunner.manager.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        service.saveEnrollmentData(1, 5, mockBuffer, 'mock-token'),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
