import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SubjectService } from './subject.service';
import { Subject } from './entities/subject.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helper ──────────────────────────────────────────────────────────────────

const mockSubject = (overrides: Partial<Subject> = {}): Subject =>
  ({
    subject_id: 1,
    learning_area_id: 10,
    subject_code: 'CS101',
    name_th: 'วิทยาการคอมพิวเตอร์',
    name_en: 'Computer Science',
    credit: 3,
    hour_per_week: 3,
    flag_valid: true,
    ...overrides,
  }) as Subject;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('SubjectService', () => {
  let service: SubjectService;

  const mockSubjectRepo = {
    findOne: jest.fn(),
    delete: jest.fn(),
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
        SubjectService,
        { provide: getRepositoryToken(Subject), useValue: mockSubjectRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<SubjectService>(SubjectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return subject when found', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());

      const result = await service.findById(1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSubject());
      expect(mockSubjectRepo.findOne).toHaveBeenCalledWith({
        where: { subject_id: 1 },
      });
    });

    it('should throw NotFoundException when subject does not exist', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when filtering by subject_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSubject()]);

      const result = await service.search({ subject_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSubject()]);
    });

    it('should return results when filtering by learning_area_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSubject()]);

      const result = await service.search({ learning_area_id: 10 });

      expect(result.success).toBe(true);
    });

    it('should return results when filtering by subject_code', async () => {
      mockDataSource.query.mockResolvedValue([mockSubject()]);

      await service.search({ subject_code: 'CS101' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('s.subject_code =');
      expect(values).toContain('CS101');
    });

    it('should return results when filtering by name_th', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ name_th: 'วิทยาการคอมพิวเตอร์' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('s.name_th =');
      expect(values).toContain('วิทยาการคอมพิวเตอร์');
    });

    it('should return results when filtering by name_en', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ name_en: 'Computer Science' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('s.name_en =');
      expect(values).toContain('Computer Science');
    });

    it('should return results when filtering by credit', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ credit: 3 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('s.credit =');
      expect(values).toContain(3);
    });

    it('should return results when filtering by hour_per_week', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ hour_per_week: 3 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('s.hour_per_week =');
      expect(values).toContain(3);
    });

    it('should return results when filtering by inst_id', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('la.inst_id =');
      expect(values).toContain(1);
    });

    it('should filter by flag_valid boolean true', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ flag_valid: true });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('s.flag_valid =');
      expect(values).toContain(true);
    });

    it('should filter by flag_valid boolean false', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ flag_valid: false });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('s.flag_valid =');
      expect(values).toContain(false);
    });

    it('should apply keyword search with ILIKE on subject_code and name_th', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ keyword: 'math' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ILIKE');
      expect(values).toContain('%math%');
    });

    it('should apply sort with DESC order', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        subject_id: 1,
        sort_by: 'subject_code',
        sort_order: 'DESC',
      });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY s.subject_code DESC');
    });

    it('should default sort order to ASC when sort_order is not DESC', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ subject_id: 1, sort_by: 'subject_code' });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ASC');
    });

    it('should apply limit and offset for pagination', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1, limit: 10, offset: 20 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('LIMIT');
      expect(queryStr).toContain('OFFSET');
      expect(values).toContain(10);
      expect(values).toContain(20);
    });

    it('should join with learning_area table', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ subject_id: 1 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('LEFT JOIN learning_area la');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.search({ inst_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      learning_area_id: 10,
      subject_code: 'CS101',
      name_th: 'วิทยาการคอมพิวเตอร์',
      name_en: 'Computer Science',
      credit: 3,
      hour_per_week: 3,
    };

    it('should throw BadRequestException when learning_area_id is missing', async () => {
      await expect(
        service.create({ ...createDto, learning_area_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when subject_code is missing', async () => {
      await expect(
        service.create({ ...createDto, subject_code: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when name_th is missing', async () => {
      await expect(
        service.create({ ...createDto, name_th: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when credit is missing', async () => {
      await expect(
        service.create({ ...createDto, credit: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when hour_per_week is missing', async () => {
      await expect(
        service.create({ ...createDto, hour_per_week: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create subject and return success with data', async () => {
      const created = mockSubject();
      mockDataSource.query.mockResolvedValue([created]);

      const result = await service.create(createDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(result.message).toContain('created');
    });

    it('should use null for name_en when not provided', async () => {
      mockDataSource.query.mockResolvedValue([mockSubject()]);
      const dto = { ...createDto };
      delete (dto as any).name_en;

      await service.create(dto);

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values).toContain(null);
    });

    it('should insert with flag_valid = true by default', async () => {
      mockDataSource.query.mockResolvedValue([mockSubject()]);

      await service.create(createDto);

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('INSERT INTO subject');
      expect(values).toContain(true);
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      mockDataSource.query.mockRejectedValue({ code: '23505' });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when subject does not exist', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { subject_code: 'NEW101' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should update subject_code and return updated record', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      const updated = mockSubject({ subject_code: 'NEW101' });
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.update(1, { subject_code: 'NEW101' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
      expect(result.message).toContain('updated');
    });

    it('should update learning_area_id', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockResolvedValue([mockSubject({ learning_area_id: 20 })]);

      const result = await service.update(1, { learning_area_id: 20 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('learning_area_id =');
      expect(values).toContain(20);
      expect(result.success).toBe(true);
    });

    it('should update name_th', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockResolvedValue([mockSubject({ name_th: 'คณิตศาสตร์' })]);

      await service.update(1, { name_th: 'คณิตศาสตร์' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('name_th =');
      expect(values).toContain('คณิตศาสตร์');
    });

    it('should update name_en', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockResolvedValue([mockSubject({ name_en: 'Mathematics' })]);

      await service.update(1, { name_en: 'Mathematics' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('name_en =');
      expect(values).toContain('Mathematics');
    });

    it('should update credit', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockResolvedValue([mockSubject({ credit: 4 })]);

      await service.update(1, { credit: 4 });

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values).toContain(4);
    });

    it('should update hour_per_week', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockResolvedValue([mockSubject({ hour_per_week: 6 })]);

      await service.update(1, { hour_per_week: 6 });

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values).toContain(6);
    });

    it('should update flag_valid to false', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockResolvedValue([mockSubject({ flag_valid: false })]);

      await service.update(1, { flag_valid: false });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('flag_valid =');
      expect(values).toContain(false);
    });

    it('should always append updated_at = NOW() to update query', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockResolvedValue([mockSubject()]);

      await service.update(1, { subject_code: 'X' });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('updated_at = NOW()');
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockRejectedValue({ code: '23505' });

      await expect(
        service.update(1, { subject_code: 'dup' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on other error', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update(1, { subject_code: 'err' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when subject does not exist', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete subject and return success with deleted data', async () => {
      const existing = mockSubject();
      mockSubjectRepo.findOne.mockResolvedValue(existing);
      mockSubjectRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(existing);
      expect(result.message).toBeDefined();
      expect(mockSubjectRepo.delete).toHaveBeenCalledWith({ subject_id: 1 });
    });

    it('should throw InternalServerErrorException on delete error', async () => {
      mockSubjectRepo.findOne.mockResolvedValue(mockSubject());
      mockSubjectRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
