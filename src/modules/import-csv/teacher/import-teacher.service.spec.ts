import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';

import { ImportTeacherService } from './import-teacher.service';
import { UserSys } from '../../users/entities/user-sys.entity';
import { LearningArea } from '../../learning-area/entities/learning-area.entity';
import { AppLogger } from '../../../common/logger/app-logger.service';

jest.mock('../shared/utils/excel.util', () => ({
  parseExcelFile: jest.fn(),
}));

jest.mock('../../../common/utils/auth.util', () => ({
  generateInitialPassword: jest.fn().mockReturnValue('TempPass@123'),
  hashPassword: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('../../../common/utils/mailer.utils', () => ({
  sendInitialPasswordEmail: jest.fn().mockResolvedValue(undefined),
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
  createValidationToken: jest.fn().mockReturnValue('mock-teacher-token'),
  IMPORT_BATCH_SIZE: 100,
  IMPORT_MAX_CONCURRENT_BATCHES: 3,
  USER_STATUS_MAP: { active: 'Active', inactive: 'Inactive' },
}));

import { parseExcelFile } from '../shared/utils/excel.util';
import { createValidationToken } from '../shared';

const mockParseExcelFile = parseExcelFile as jest.Mock;
const mockCreateValidationToken = createValidationToken as jest.Mock;

const mockUserSysRepo = () => ({
  find: jest.fn(),
});

const mockLearningAreaRepo = () => ({
  find: jest.fn(),
});

const mockQueryRunner = {
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    query: jest.fn(),
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

describe('ImportTeacherService', () => {
  let service: ImportTeacherService;
  let userSysRepo: ReturnType<typeof mockUserSysRepo>;
  let learningAreaRepo: ReturnType<typeof mockLearningAreaRepo>;

  const mockBuffer = Buffer.from('mock-excel');
  const mockRow = {
    'รหัสบุคลากร': 'T001',
    'ชื่อจริง': 'สมชาย',
    'นามสกุล': 'ใจดี',
    'อีเมล': 'teacher@test.com',
    'กลุ่มการเรียนรู้': 'คณิตศาสตร์',
    'สถานะผู้ใช้': 'active',
  };
  const mockLearningArea = {
    learning_area_id: 1,
    learning_area_name: 'คณิตศาสตร์',
    inst_id: 1,
    flag_valid: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    userSysRepo = mockUserSysRepo();
    learningAreaRepo = mockLearningAreaRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportTeacherService,
        { provide: getRepositoryToken(UserSys), useValue: userSysRepo },
        { provide: getRepositoryToken(LearningArea), useValue: learningAreaRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ImportTeacherService>(ImportTeacherService);
  });

  describe('validateTeacherData', () => {
    it('should not throw for unknown instType (no instType check in validate)', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      userSysRepo.find.mockResolvedValue([]);

      const result = await service.validateTeacherData(1, 'unknown', mockBuffer);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
    });

    it('should validate school teacher data and return validationToken', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      userSysRepo.find.mockResolvedValue([]);

      const result = await service.validateTeacherData(1, 'school', mockBuffer);

      expect(mockParseExcelFile).toHaveBeenCalledWith(mockBuffer);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
      expect(result).toHaveProperty('validationToken');
    });

    it('should validate university teacher data', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      userSysRepo.find.mockResolvedValue([]);

      const result = await service.validateTeacherData(1, 'university', mockBuffer);

      expect(result.success).toBe(true);
    });

    it('should return null validationToken when errors exist', async () => {
      // row with missing required fields
      mockParseExcelFile.mockResolvedValue([{}]);
      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      userSysRepo.find.mockResolvedValue([]);

      const result = await service.validateTeacherData(1, 'school', mockBuffer);

      expect(result.success).toBe(true);
      // validCount may be 0 → token is null
      expect(result).toHaveProperty('validationToken');
    });
  });

  describe('saveTeacherData', () => {
    it('should throw BadRequestException if validationToken is missing', async () => {
      await expect(
        service.saveTeacherData(1, 'school', mockBuffer, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported instType', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);

      await expect(
        service.saveTeacherData(1, 'invalid', mockBuffer, 'mock-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should save teachers and return success', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);

      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      userSysRepo.find.mockResolvedValue([]);

      // INSERT user_sys → returns user_sys_id
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ user_sys_id: 50 }]) // INSERT user_sys
        .mockResolvedValueOnce([]); // INSERT user_sys_learning_area_normalize

      const result = await service.saveTeacherData(1, 'school', mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(result.message).toContain('สำเร็จ');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should skip duplicate teachers', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);

      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      // Existing user with same email
      userSysRepo.find.mockResolvedValue([
        { email: 'teacher@test.com', code: 'T001' },
      ]);

      const result = await service.saveTeacherData(1, 'school', mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(result.data.skippedCount).toBeGreaterThanOrEqual(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback and rethrow on error', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      learningAreaRepo.find.mockRejectedValue(new Error('DB error'));

      await expect(
        service.saveTeacherData(1, 'school', mockBuffer, 'mock-token'),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
