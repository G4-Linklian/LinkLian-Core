import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';

import { ImportProgramService } from './import-program.service';
import { Program } from '../../program/entities/program.entity';
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
  createValidationToken: jest.fn().mockReturnValue('mock-program-token'),
  verifyValidationToken: jest.fn().mockReturnValue({
    type: 'program',
    instId: 1,
    dataHash: 'mock-hash',
    validCount: 1,
    duplicateCount: 0,
  }),
  IMPORT_BATCH_SIZE: 100,
  IMPORT_MAX_CONCURRENT_BATCHES: 3,
}));

import { parseExcelFile } from '../shared/utils/excel.util';
import { verifyValidationToken } from '../shared';

const mockParseExcelFile = parseExcelFile as jest.Mock;
const mockVerifyValidationToken = verifyValidationToken as jest.Mock;

const mockProgramRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
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

describe('ImportProgramService', () => {
  let service: ImportProgramService;
  let programRepo: ReturnType<typeof mockProgramRepo>;

  const mockBuffer = Buffer.from('mock-excel');

  const mockSchoolRow = { 'แผนการเรียน': 'วิทย์-คณิต', 'ห้องเรียน': 'ม.4/1' };
  const mockUniRow = { 'คณะ': 'วิศวกรรมศาสตร์', 'ภาค': 'คอมพิวเตอร์', 'สาขา': 'Software' };

  beforeEach(async () => {
    jest.clearAllMocks();

    programRepo = mockProgramRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportProgramService,
        { provide: getRepositoryToken(Program), useValue: programRepo },
        { provide: getRepositoryToken(Institution), useValue: mockInstitutionRepo() },
        { provide: JwtService, useValue: mockJwtService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ImportProgramService>(ImportProgramService);
  });

  describe('validateProgramData', () => {
    it('should throw BadRequestException for unsupported instType', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);

      await expect(
        service.validateProgramData(1, 'invalid', mockBuffer),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate school program data successfully', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);

      programRepo.find.mockResolvedValue([]);

      const result = await service.validateProgramData(1, 'school', mockBuffer);

      expect(mockParseExcelFile).toHaveBeenCalledWith(mockBuffer);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('validatedData');
      expect(result.data).toHaveProperty('summary');
    });

    it('should validate university program data successfully', async () => {
      mockParseExcelFile.mockResolvedValue([mockUniRow]);

      programRepo.find.mockResolvedValue([]);

      const result = await service.validateProgramData(1, 'university', mockBuffer);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
    });

    it('should return validationToken when no errors', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);
      programRepo.find.mockResolvedValue([]);

      const result = await service.validateProgramData(1, 'school', mockBuffer);

      expect(result).toHaveProperty('validationToken');
    });
  });

  describe('saveProgramData', () => {
    it('should throw BadRequestException if validationToken is missing', async () => {
      await expect(
        service.saveProgramData(1, 'school', mockBuffer, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported instType', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);

      await expect(
        service.saveProgramData(1, 'invalid', mockBuffer, 'mock-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should save school programs and return success', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);
      mockVerifyValidationToken.mockReturnValue({
        type: 'program', instId: 1, dataHash: 'mock-hash', validCount: 1, duplicateCount: 0,
      });

      programRepo.find.mockResolvedValue([]);

      // saveSchoolBatch: insert study_plan (returns program_id), insert class (returns program_id)
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ program_id: 10 }]) // insert study plan
        .mockResolvedValueOnce([{ program_id: 11 }]); // insert class

      const result = await service.saveProgramData(1, 'school', mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(result.message).toContain('สำเร็จ');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should save university programs and return success', async () => {
      mockParseExcelFile.mockResolvedValue([mockUniRow]);
      mockVerifyValidationToken.mockReturnValue({
        type: 'program', instId: 1, dataHash: 'mock-hash', validCount: 1, duplicateCount: 0,
      });

      programRepo.find.mockResolvedValue([]);

      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ program_id: 20 }]) // faculty
        .mockResolvedValueOnce([{ program_id: 21 }]) // department
        .mockResolvedValueOnce([{ program_id: 22 }]); // major

      const result = await service.saveProgramData(1, 'university', mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback and rethrow on error', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);
      mockVerifyValidationToken.mockReturnValue({
        type: 'program', instId: 1, dataHash: 'mock-hash', validCount: 1, duplicateCount: 0,
      });

      programRepo.find.mockRejectedValue(new Error('DB error'));

      await expect(
        service.saveProgramData(1, 'school', mockBuffer, 'mock-token'),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
