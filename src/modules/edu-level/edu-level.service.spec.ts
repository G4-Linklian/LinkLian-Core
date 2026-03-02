import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { EduLevelService } from './edu-level.service';
import { EduLevel } from './entities/edu-level.entity';
import { EduLevelProgramNormalize } from './entities/edu-level-program-normalize.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockEduLevel = (overrides: Partial<EduLevel> = {}): EduLevel =>
  ({
    edu_lev_id: 1,
    level_name: 'ม.1',
    edu_type: 'high school',
    flag_valid: true,
    ...overrides,
  }) as EduLevel;

const mockNorm = (
  overrides: Partial<EduLevelProgramNormalize> = {},
): EduLevelProgramNormalize =>
  ({
    edu_lev_id: 1,
    program_id: 10,
    flag_valid: true,
    ...overrides,
  }) as EduLevelProgramNormalize;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('EduLevelService', () => {
  let service: EduLevelService;

  const mockEduLevelRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockNormRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

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
        EduLevelService,
        { provide: getRepositoryToken(EduLevel), useValue: mockEduLevelRepo },
        {
          provide: getRepositoryToken(EduLevelProgramNormalize),
          useValue: mockNormRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<EduLevelService>(EduLevelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException when edu level does not exist', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('should return edu level data on success', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(mockEduLevel());

      const result = await service.findById(1);

      expect(result).toEqual({ success: true, data: mockEduLevel() });
    });
  });

  // ─── searchMaster ──────────────────────────────────────────────────────────

  describe('searchMaster', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.searchMaster({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when searching by edu_lev_id', async () => {
      mockDataSource.query.mockResolvedValue([mockEduLevel()]);

      const result = await service.searchMaster({ edu_lev_id: 1 });

      expect(result).toEqual({ success: true, data: [mockEduLevel()] });
    });

    it('should return results when searching by level_name', async () => {
      mockDataSource.query.mockResolvedValue([mockEduLevel()]);

      const result = await service.searchMaster({ level_name: 'ม.1' });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by edu_type', async () => {
      mockDataSource.query.mockResolvedValue([mockEduLevel()]);

      const result = await service.searchMaster({ edu_type: 'high school' });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([mockEduLevel()]);

      const result = await service.searchMaster({ flag_valid: true });

      expect(result.success).toBe(true);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.searchMaster({ edu_lev_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── search (with join) ────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when searching by inst_id', async () => {
      mockDataSource.query.mockResolvedValue([mockEduLevel()]);

      const result = await service.search({ inst_id: 1 });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by program_id', async () => {
      mockDataSource.query.mockResolvedValue([mockEduLevel()]);

      const result = await service.search({ program_id: 10 });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by parent_id', async () => {
      mockDataSource.query.mockResolvedValue([mockEduLevel()]);

      const result = await service.search({ parent_id: 5 });

      expect(result.success).toBe(true);
    });

    it('should apply sort and pagination in query', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        inst_id: 1,
        sort_by: 'edu_lev_id',
        sort_order: 'DESC',
        limit: 10,
        offset: 5,
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('DESC');
      expect(queryStr).toContain('LIMIT');
      expect(values).toContain(10);
      expect(values).toContain(5);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.search({ inst_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = { level_name: 'ม.1', edu_type: 'high school' };

    it('should throw BadRequestException when level_name is missing', async () => {
      await expect(
        service.create({ level_name: '', edu_type: 'high school' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when edu_type is missing', async () => {
      await expect(
        service.create({ level_name: 'ม.1', edu_type: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create edu level and return success', async () => {
      const created = mockEduLevel();
      mockEduLevelRepo.create.mockReturnValue(created);
      mockEduLevelRepo.save.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(result).toMatchObject({
        success: true,
        message: 'EduLevel created successfully',
        data: created,
      });
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockEduLevelRepo.create.mockReturnValue(mockEduLevel());
      const dbError = Object.assign(new Error('duplicate'), { code: '23505' });
      mockEduLevelRepo.save.mockRejectedValue(dbError);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockEduLevelRepo.create.mockReturnValue(mockEduLevel());
      mockEduLevelRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when edu level does not exist', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { level_name: 'ม.2' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(mockEduLevel());

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should update edu level and return updated data', async () => {
      const updated = mockEduLevel({ level_name: 'ม.2' });
      mockEduLevelRepo.findOne
        .mockResolvedValueOnce(mockEduLevel())
        .mockResolvedValueOnce(updated);
      mockEduLevelRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { level_name: 'ม.2' });

      expect(result).toMatchObject({
        success: true,
        message: 'EduLevel updated successfully',
        data: updated,
      });
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(mockEduLevel());
      const dbError = Object.assign(new Error('duplicate'), { code: '23505' });
      mockEduLevelRepo.update.mockRejectedValue(dbError);

      await expect(
        service.update(1, { level_name: 'ม.1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(mockEduLevel());
      mockEduLevelRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update(1, { level_name: 'ม.2' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when edu level does not exist', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete edu level and return success', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(mockEduLevel());
      mockEduLevelRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result).toMatchObject({
        success: true,
        message: 'EduLevel deleted successfully',
      });
      expect(mockEduLevelRepo.delete).toHaveBeenCalledWith({ edu_lev_id: 1 });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockEduLevelRepo.findOne.mockResolvedValue(mockEduLevel());
      mockEduLevelRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createNormalize ──────────────────────────────────────────────────────

  describe('createNormalize', () => {
    const createNormDto = { edu_lev_id: 1, program_id: 10 };

    it('should throw BadRequestException when edu_lev_id is missing', async () => {
      await expect(
        service.createNormalize({ edu_lev_id: 0, program_id: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when program_id is missing', async () => {
      await expect(
        service.createNormalize({ edu_lev_id: 1, program_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create normalize record and return success', async () => {
      const created = mockNorm();
      mockNormRepo.create.mockReturnValue(created);
      mockNormRepo.save.mockResolvedValue(created);

      const result = await service.createNormalize(createNormDto);

      expect(result).toMatchObject({
        success: true,
        message: 'EduLevel normalize created successfully',
        data: created,
      });
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockNormRepo.create.mockReturnValue(mockNorm());
      const dbError = Object.assign(new Error('duplicate'), { code: '23505' });
      mockNormRepo.save.mockRejectedValue(dbError);

      await expect(service.createNormalize(createNormDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockNormRepo.create.mockReturnValue(mockNorm());
      mockNormRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createNormalize(createNormDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── updateNormalize ──────────────────────────────────────────────────────

  describe('updateNormalize', () => {
    const updateNormDto = { edu_lev_id: 1, program_id: 10 };

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.updateNormalize({ edu_lev_id: 0, program_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.updateNormalize(updateNormDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update normalize record and return success', async () => {
      const updated = mockNorm();
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.updateNormalize(updateNormDto);

      expect(result).toMatchObject({
        success: true,
        message: 'EduLevel normalize updated successfully',
        data: updated,
      });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.updateNormalize(updateNormDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── deleteNormalize ──────────────────────────────────────────────────────

  describe('deleteNormalize', () => {
    const deleteNormDto = { edu_lev_id: 1, program_id: 10 };

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.deleteNormalize({ edu_lev_id: 0, program_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.deleteNormalize(deleteNormDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete normalize record and return success', async () => {
      const deleted = mockNorm();
      mockDataSource.query.mockResolvedValue([deleted]);

      const result = await service.deleteNormalize(deleteNormDto);

      expect(result).toMatchObject({
        success: true,
        message: 'EduLevel normalize deleted successfully',
        data: deleted,
      });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteNormalize(deleteNormDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
