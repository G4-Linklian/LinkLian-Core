import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';

import { ImportStudentService } from './import-student.service';
import { UserSys } from '../../users/entities/user-sys.entity';
import { EduLevel } from '../../edu-level/entities/edu-level.entity';
import { Program } from '../../program/entities/program.entity';
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
  createValidationToken: jest.fn().mockReturnValue('mock-student-token'),
  verifyValidationToken: jest.fn().mockReturnValue({
    type: 'student',
    instId: 1,
    dataHash: 'mock-hash',
    validCount: 1,
    duplicateCount: 0,
  }),
  IMPORT_BATCH_SIZE: 100,
  IMPORT_MAX_CONCURRENT_BATCHES: 3,
  USER_STATUS_MAP: { active: 'Active', inactive: 'Inactive', graduated: 'Graduated' },
}));

import { parseExcelFile } from '../shared/utils/excel.util';
import { verifyValidationToken } from '../shared';

const mockParseExcelFile = parseExcelFile as jest.Mock;
const mockVerifyValidationToken = verifyValidationToken as jest.Mock;

const mockUserSysRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
});

const mockEduLevelRepo = () => ({
  find: jest.fn(),
});

const mockProgramRepo = () => ({
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

describe('ImportStudentService', () => {
  let service: ImportStudentService;
  let userSysRepo: ReturnType<typeof mockUserSysRepo>;
  let eduLevelRepo: ReturnType<typeof mockEduLevelRepo>;
  let programRepo: ReturnType<typeof mockProgramRepo>;

  const mockBuffer = Buffer.from('mock-excel');

  const mockSchoolRow = {
    'รหัสนักเรียน': 'S001',
    'ชื่อจริง': 'สมชาย',
    'นามสกุล': 'ใจดี',
    'อีเมล': 'somchai@test.com',
    'ระดับชั้น/ชั้นปี': 'ม.4',
    'สถานะผู้ใช้': 'active',
    'แผนการเรียน': 'วิทย์-คณิต',
    'ห้องเรียน': 'ม.4/1',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    userSysRepo = mockUserSysRepo();
    eduLevelRepo = mockEduLevelRepo();
    programRepo = mockProgramRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportStudentService,
        { provide: getRepositoryToken(UserSys), useValue: userSysRepo },
        { provide: getRepositoryToken(EduLevel), useValue: eduLevelRepo },
        { provide: getRepositoryToken(Program), useValue: programRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ImportStudentService>(ImportStudentService);
  });

  describe('validateStudentData', () => {
    it('should not throw for unknown instType (uses UniDto as fallback)', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);
      userSysRepo.find.mockResolvedValue([]);
      eduLevelRepo.find.mockResolvedValue([]);
      programRepo.find.mockResolvedValue([]);

      const result = await service.validateStudentData(1, 'unknown', mockBuffer);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
    });

    it('should validate school student data and return validationToken', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);

      userSysRepo.find.mockResolvedValue([]);
      eduLevelRepo.find.mockResolvedValue([
        { edu_lev_id: 1, level_name: 'ม.4' },
      ]);
      programRepo.find.mockResolvedValue([]);

      const result = await service.validateStudentData(1, 'school', mockBuffer);

      expect(mockParseExcelFile).toHaveBeenCalledWith(mockBuffer);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
      expect(result).toHaveProperty('validationToken');
    });

    it('should validate university student data', async () => {
      const uniRow = {
        'รหัสนักศึกษา': 'U001',
        'ชื่อจริง': 'สมหญิง',
        'นามสกุล': 'รักเรียน',
        'อีเมล': 'somying@test.com',
        'ระดับชั้น/ชั้นปี': 'ปริญญาตรี',
        'สถานะผู้ใช้': 'active',
        'คณะ': 'วิศวกรรมศาสตร์',
        'ภาค': 'คอมพิวเตอร์',
        'สาขา': 'Software',
      };
      mockParseExcelFile.mockResolvedValue([uniRow]);
      userSysRepo.find.mockResolvedValue([]);
      eduLevelRepo.find.mockResolvedValue([
        { edu_lev_id: 2, level_name: 'ปริญญาตรี' },
      ]);
      programRepo.find.mockResolvedValue([]);

      const result = await service.validateStudentData(1, 'university', mockBuffer);

      expect(result.success).toBe(true);
    });
  });

  describe('saveStudentData', () => {
    it('should throw BadRequestException if validationToken is missing', async () => {
      await expect(
        service.saveStudentData(1, 'school', mockBuffer, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported instType', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);

      await expect(
        service.saveStudentData(1, 'unknown', mockBuffer, 'mock-token'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should save students and return success', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);
      mockVerifyValidationToken.mockReturnValue({
        type: 'student', instId: 1, dataHash: 'mock-hash', validCount: 1, duplicateCount: 0,
      });

      const mockEduLevel = { edu_lev_id: 1, level_name: 'ม.4' };
      const mockStudyPlan = {
        program_id: 10, program_name: 'วิทย์-คณิต', program_type: 'study_plan',
        parent_id: null, flag_valid: true, inst_id: 1,
      };
      const mockClassroom = {
        program_id: 11, program_name: 'ม.4/1', program_type: 'class',
        parent_id: 10, flag_valid: true, inst_id: 1,
      };

      eduLevelRepo.find.mockResolvedValue([mockEduLevel]);
      programRepo.find.mockResolvedValue([mockStudyPlan, mockClassroom]);
      userSysRepo.find.mockResolvedValue([]);

      // insert user_sys → returning user_sys_id
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ user_sys_id: 100 }]) // INSERT user_sys
        .mockResolvedValueOnce([]); // INSERT user_sys_program_normalize

      const result = await service.saveStudentData(1, 'school', mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(result.message).toContain('สำเร็จ');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback and rethrow on error', async () => {
      mockParseExcelFile.mockResolvedValue([mockSchoolRow]);
      mockVerifyValidationToken.mockReturnValue({
        type: 'student', instId: 1, dataHash: 'mock-hash', validCount: 1, duplicateCount: 0,
      });

      eduLevelRepo.find.mockRejectedValue(new Error('DB error'));

      await expect(
        service.saveStudentData(1, 'school', mockBuffer, 'mock-token'),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});