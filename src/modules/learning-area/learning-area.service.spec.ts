import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { LearningAreaService } from './learning-area.service';
import { LearningArea } from './entities/learning-area.entity';
import { UserSysLearningAreaNormalize } from './entities/user-sys-learning-area-normalize.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockLearningArea = (
  overrides: Partial<LearningArea> = {},
): LearningArea =>
  ({
    learning_area_id: 1,
    inst_id: 1,
    learning_area_name: 'Mathematics',
    remark: 'Core subject',
    flag_valid: true,
    ...overrides,
  }) as LearningArea;

const mockUserNorm = (
  overrides: Partial<UserSysLearningAreaNormalize> = {},
): UserSysLearningAreaNormalize =>
  ({
    learning_area_id: 1,
    user_sys_id: 100,
    flag_valid: true,
    ...overrides,
  }) as UserSysLearningAreaNormalize;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('LearningAreaService', () => {
  let service: LearningAreaService;

  const mockLearningAreaRepo = {
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
        LearningAreaService,
        {
          provide: getRepositoryToken(LearningArea),
          useValue: mockLearningAreaRepo,
        },
        {
          provide: getRepositoryToken(UserSysLearningAreaNormalize),
          useValue: mockNormRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<LearningAreaService>(LearningAreaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException when learning area does not exist', async () => {
      mockLearningAreaRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('should return learning area data on success', async () => {
      mockLearningAreaRepo.findOne.mockResolvedValue(mockLearningArea());

      const result = await service.findById(1);

      expect(result).toEqual({ success: true, data: mockLearningArea() });
    });
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when searching by inst_id', async () => {
      mockDataSource.query.mockResolvedValue([mockLearningArea()]);

      const result = await service.search({ inst_id: 1 });

      expect(result).toEqual({ success: true, data: [mockLearningArea()] });
    });

    it('should return results when searching by learning_area_id', async () => {
      mockDataSource.query.mockResolvedValue([mockLearningArea()]);

      const result = await service.search({ learning_area_id: 1 });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by learning_area_name', async () => {
      mockDataSource.query.mockResolvedValue([mockLearningArea()]);

      const result = await service.search({
        learning_area_name: 'Mathematics',
      });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by remark', async () => {
      mockDataSource.query.mockResolvedValue([mockLearningArea()]);

      const result = await service.search({ remark: 'Core subject' });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([mockLearningArea()]);

      const result = await service.search({ flag_valid: true });

      expect(result.success).toBe(true);
    });

    it('should apply keyword ILIKE filter in query', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1, keyword: 'Math' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ILIKE');
      expect(values).toContain('%Math%');
    });

    it('should include subject COUNT when subject_count is true', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1, subject_count: true });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('COUNT(s.subject_id)');
      expect(queryStr).toContain('GROUP BY');
    });

    it('should apply sort and pagination in query', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        inst_id: 1,
        sort_by: 'learning_area_name',
        sort_order: 'DESC',
        limit: 5,
        offset: 10,
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('DESC');
      expect(queryStr).toContain('LIMIT');
      expect(values).toContain(5);
      expect(values).toContain(10);
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
    const createDto = { inst_id: 1, learning_area_name: 'Mathematics' };

    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(
        service.create({ inst_id: 0, learning_area_name: 'Mathematics' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when learning_area_name is missing', async () => {
      await expect(
        service.create({ inst_id: 1, learning_area_name: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create learning area and return success', async () => {
      const created = mockLearningArea();
      mockLearningAreaRepo.create.mockReturnValue(created);
      mockLearningAreaRepo.save.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(result).toMatchObject({
        success: true,
        message: 'Learning area created successfully!',
        data: created,
      });
      expect(mockLearningAreaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inst_id: 1,
          learning_area_name: 'Mathematics',
          flag_valid: true,
        }),
      );
    });

    it('should set remark to null when not provided', async () => {
      const created = mockLearningArea({ remark: null });
      mockLearningAreaRepo.create.mockReturnValue(created);
      mockLearningAreaRepo.save.mockResolvedValue(created);

      await service.create(createDto);

      expect(mockLearningAreaRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ remark: null }),
      );
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockLearningAreaRepo.create.mockReturnValue(mockLearningArea());
      const dbError = Object.assign(new Error('duplicate'), { code: '23505' });
      mockLearningAreaRepo.save.mockRejectedValue(dbError);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockLearningAreaRepo.create.mockReturnValue(mockLearningArea());
      mockLearningAreaRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when learning area does not exist', async () => {
      mockLearningAreaRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { learning_area_name: 'Science' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockLearningAreaRepo.findOne.mockResolvedValue(mockLearningArea());

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should update learning area and return updated data', async () => {
      const updated = mockLearningArea({ learning_area_name: 'Science' });
      mockLearningAreaRepo.findOne
        .mockResolvedValueOnce(mockLearningArea())
        .mockResolvedValueOnce(updated);
      mockLearningAreaRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, {
        learning_area_name: 'Science',
      });

      expect(result).toMatchObject({
        success: true,
        message: 'Learning area updated successfully!',
        data: updated,
      });
    });

    it('should update flag_valid field', async () => {
      mockLearningAreaRepo.findOne
        .mockResolvedValueOnce(mockLearningArea())
        .mockResolvedValueOnce(mockLearningArea({ flag_valid: false }));
      mockLearningAreaRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { flag_valid: false });

      expect(result.success).toBe(true);
      expect(mockLearningAreaRepo.update).toHaveBeenCalledWith(
        { learning_area_id: 1 },
        expect.objectContaining({ flag_valid: false }),
      );
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockLearningAreaRepo.findOne.mockResolvedValue(mockLearningArea());
      const dbError = Object.assign(new Error('duplicate'), { code: '23505' });
      mockLearningAreaRepo.update.mockRejectedValue(dbError);

      await expect(
        service.update(1, { learning_area_name: 'Mathematics' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockLearningAreaRepo.findOne.mockResolvedValue(mockLearningArea());
      mockLearningAreaRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update(1, { learning_area_name: 'Science' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when learning area does not exist', async () => {
      mockLearningAreaRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete learning area and return success', async () => {
      const existing = mockLearningArea();
      mockLearningAreaRepo.findOne.mockResolvedValue(existing);
      mockLearningAreaRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result).toMatchObject({
        success: true,
        message: 'Learning area deleted successfully!',
        data: existing,
      });
      expect(mockLearningAreaRepo.delete).toHaveBeenCalledWith({
        learning_area_id: 1,
      });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockLearningAreaRepo.findOne.mockResolvedValue(mockLearningArea());
      mockLearningAreaRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createUserSysNormalize ────────────────────────────────────────────────

  describe('createUserSysNormalize', () => {
    const createDto = { learning_area_id: 1, user_sys_id: 100 };

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.createUserSysNormalize({
          learning_area_id: 0,
          user_sys_id: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create normalize record and return success', async () => {
      const created = mockUserNorm();
      mockNormRepo.create.mockReturnValue(created);
      mockNormRepo.save.mockResolvedValue(created);

      const result = await service.createUserSysNormalize(createDto);

      expect(result).toMatchObject({
        success: true,
        message: 'Record created successfully!',
        data: created,
      });
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockNormRepo.create.mockReturnValue(mockUserNorm());
      const dbError = Object.assign(new Error('duplicate'), { code: '23505' });
      mockNormRepo.save.mockRejectedValue(dbError);

      await expect(service.createUserSysNormalize(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockNormRepo.create.mockReturnValue(mockUserNorm());
      mockNormRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createUserSysNormalize(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── updateUserSysNormalize ────────────────────────────────────────────────

  describe('updateUserSysNormalize', () => {
    const updateDto = {
      user_sys_id: 100,
      learning_area_id: 1,
      flag_valid: true,
    };

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.updateUserSysNormalize({
          user_sys_id: 0,
          learning_area_id: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.updateUserSysNormalize(updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update normalize record and return success', async () => {
      const updated = mockUserNorm();
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.updateUserSysNormalize(updateDto);

      expect(result).toMatchObject({
        success: true,
        message: 'User learning area updated successfully!',
        data: updated,
      });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.updateUserSysNormalize(updateDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── deleteUserSysNormalize ────────────────────────────────────────────────

  describe('deleteUserSysNormalize', () => {
    const deleteDto = { learning_area_id: 1, user_sys_id: 100 };

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.deleteUserSysNormalize({
          learning_area_id: 0,
          user_sys_id: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when record not found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.deleteUserSysNormalize(deleteDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete normalize record and return success', async () => {
      const deleted = mockUserNorm();
      mockDataSource.query.mockResolvedValue([deleted]);

      const result = await service.deleteUserSysNormalize(deleteDto);

      expect(result).toMatchObject({
        success: true,
        message: 'User learning area deleted successfully!',
        data: deleted,
      });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteUserSysNormalize(deleteDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createUserSysNormalizeInternal ───────────────────────────────────────

  describe('createUserSysNormalizeInternal', () => {
    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.createUserSysNormalizeInternal(0, 0),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create normalize record internally and return success', async () => {
      const created = mockUserNorm();
      mockNormRepo.create.mockReturnValue(created);
      mockNormRepo.save.mockResolvedValue(created);

      const result = await service.createUserSysNormalizeInternal(100, 1);

      expect(result).toMatchObject({
        success: true,
        message: 'User learning area created successfully!',
        data: created,
      });
    });

    it('should rethrow error on failure', async () => {
      mockNormRepo.create.mockReturnValue(mockUserNorm());
      mockNormRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createUserSysNormalizeInternal(100, 1),
      ).rejects.toThrow('DB error');
    });
  });
});
