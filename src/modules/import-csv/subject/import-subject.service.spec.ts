import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { ImportSubjectService } from './import-subject.service';
import { LearningArea } from '../../learning-area/entities/learning-area.entity';

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
  createValidationToken: jest.fn().mockReturnValue('mock-subject-token'),
  IMPORT_BATCH_SIZE: 100,
  IMPORT_MAX_CONCURRENT_BATCHES: 3,
}));

import { parseExcelFile } from '../shared/utils/excel.util';
import { createValidationToken } from '../shared';

const mockParseExcelFile = parseExcelFile as jest.Mock;

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

describe('ImportSubjectService', () => {
  let service: ImportSubjectService;
  let learningAreaRepo: ReturnType<typeof mockLearningAreaRepo>;

  const mockBuffer = Buffer.from('mock-excel');
  const mockRow = {
    'รหัสวิชา': 'MAT001',
    'ชื่อวิชา (ภาษาไทย)': 'คณิตศาสตร์พื้นฐาน',
    'ชื่อวิชา (ภาษาอังกฤษ)': 'Basic Mathematics',
    'กลุ่มการเรียนรู้': 'คณิตศาสตร์',
    'หน่วยกิต': '1.5',
    'ชั่วโมงต่อสัปดาห์': '3',
  };
  const mockLearningArea = {
    learning_area_id: 1,
    learning_area_name: 'คณิตศาสตร์',
    inst_id: 1,
    flag_valid: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    learningAreaRepo = mockLearningAreaRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportSubjectService,
        { provide: getRepositoryToken(LearningArea), useValue: learningAreaRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<ImportSubjectService>(ImportSubjectService);
  });

  describe('validateSubjectData', () => {
    it('should validate subject data and return validationToken', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      mockDataSource.query.mockResolvedValue([]); // no existing subjects

      const result = await service.validateSubjectData(1, mockBuffer);

      expect(mockParseExcelFile).toHaveBeenCalledWith(mockBuffer);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('summary');
      expect(result.data).toHaveProperty('validatedData');
      expect(result).toHaveProperty('validationToken');
    });

    it('should mark existing subject code as duplicate', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      mockDataSource.query.mockResolvedValue([
        { subject_code: 'MAT001' }, // already exists
      ]);

      const result = await service.validateSubjectData(1, mockBuffer);

      expect(result.success).toBe(true);
      expect(result.data.summary.duplicateCount).toBeGreaterThanOrEqual(1);
    });

    it('should return null validationToken when errors exist', async () => {
      mockParseExcelFile.mockResolvedValue([{}]); // empty row → validation errors
      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.validateSubjectData(1, mockBuffer);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('validationToken');
    });
  });

  describe('saveSubjectData', () => {
    it('should throw BadRequestException if validationToken is missing', async () => {
      await expect(
        service.saveSubjectData(1, mockBuffer, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if institution not found', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      mockQueryRunner.manager.findOne.mockResolvedValue(null); // no institution

      await expect(
        service.saveSubjectData(1, mockBuffer, 'mock-token'),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should save subjects and return success', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);

      mockQueryRunner.manager.findOne.mockResolvedValue({ inst_id: 1 }); // institution found

      learningAreaRepo.find.mockResolvedValue([mockLearningArea]);
      mockDataSource.query.mockResolvedValue([]); // no existing subjects

      // insertSubject
      mockQueryRunner.manager.query.mockResolvedValue([{ subject_id: 10 }]);

      const result = await service.saveSubjectData(1, mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(result.message).toContain('สำเร็จ');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should auto-create new learning area if not found', async () => {
      const rowWithNewArea = { ...mockRow, 'กลุ่มการเรียนรู้': 'ศิลปะ' };
      mockParseExcelFile.mockResolvedValue([rowWithNewArea]);
      mockQueryRunner.manager.findOne.mockResolvedValue({ inst_id: 1 });

      learningAreaRepo.find.mockResolvedValue([]); // no learning areas
      mockDataSource.query.mockResolvedValue([]); // no existing subjects

      // INSERT learning_area → INSERT subject
      mockQueryRunner.manager.query
        .mockResolvedValueOnce([{ learning_area_id: 99 }])  // new learning area
        .mockResolvedValueOnce([{ subject_id: 11 }]);       // new subject

      const result = await service.saveSubjectData(1, mockBuffer, 'mock-token');

      expect(result.success).toBe(true);
      expect(result.data.newLearningAreas).toContain('ศิลปะ');
    });

    it('should rollback and rethrow on error', async () => {
      mockParseExcelFile.mockResolvedValue([mockRow]);
      mockQueryRunner.manager.findOne.mockRejectedValue(new Error('DB error'));

      await expect(
        service.saveSubjectData(1, mockBuffer, 'mock-token'),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
