import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SemesterService } from './semester.service';
import { Semester } from './entities/semester.entity';
import { SemesterSubjectNormalize } from './entities/semester-subject-normalize.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockSemester = (overrides: Partial<Semester> = {}): Semester =>
  ({
    semester_id: 1,
    inst_id: 1,
    semester: '1/2567',
    start_date: new Date('2024-05-01'),
    end_date: new Date('2024-09-30'),
    flag_valid: true,
    status: 'open',
    ...overrides,
  }) as Semester;

const mockSubjectNorm = (
  overrides: Partial<SemesterSubjectNormalize> = {},
): SemesterSubjectNormalize =>
  ({
    subject_id: 10,
    semester_id: 1,
    flag_valid: true,
    ...overrides,
  }) as SemesterSubjectNormalize;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('SemesterService', () => {
  let service: SemesterService;

  const mockSemesterRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockSemesterSubjectRepo = {
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
        SemesterService,
        { provide: getRepositoryToken(Semester), useValue: mockSemesterRepo },
        {
          provide: getRepositoryToken(SemesterSubjectNormalize),
          useValue: mockSemesterSubjectRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<SemesterService>(SemesterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return semester when found', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester());

      const result = await service.findById(1);

      expect(result).toEqual(mockSemester());
      expect(mockSemesterRepo.findOne).toHaveBeenCalledWith({
        where: { semester_id: 1 },
      });
    });

    it('should throw NotFoundException when semester does not exist', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when filtering by semester_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSemester()]);

      const result = await service.search({ semester_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSemester()]);
    });

    it('should return results when filtering by inst_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSemester()]);

      const result = await service.search({ inst_id: 1 });

      expect(result.success).toBe(true);
    });

    it('should return results when filtering by semester name', async () => {
      mockDataSource.query.mockResolvedValue([mockSemester()]);

      const result = await service.search({ semester: '1/2567' });

      expect(result.success).toBe(true);
    });

    it('should return results when filtering by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([mockSemester()]);

      await service.search({ flag_valid: true });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when filtering by status', async () => {
      mockDataSource.query.mockResolvedValue([mockSemester()]);

      await service.search({ status: 'open' });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should apply start_date and end_date range filter', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        start_date: '2024-05-01',
        end_date: '2024-09-30',
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('start_date >=');
      expect(queryStr).toContain('end_date <=');
      expect(values).toContain('2024-05-01');
      expect(values).toContain('2024-09-30');
    });

    it('should apply only start_date when end_date is not provided', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ start_date: '2024-05-01' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('start_date =');
      expect(values).toContain('2024-05-01');
    });

    it('should apply only end_date when start_date is not provided', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ end_date: '2024-09-30' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('end_date =');
      expect(values).toContain('2024-09-30');
    });

    it('should apply sort and pagination', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        inst_id: 1,
        sort_by: 'semester_id',
        sort_order: 'DESC',
        limit: 10,
        offset: 5,
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('DESC');
      expect(queryStr).toContain('LIMIT');
      expect(queryStr).toContain('OFFSET');
      expect(values).toContain(10);
      expect(values).toContain(5);
    });

    it('should default sort to ASC when sort_order is not DESC', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1, sort_by: 'semester_id' });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ASC');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.search({ inst_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getActiveSemesters ────────────────────────────────────────────────────

  describe('getActiveSemesters', () => {
    it('should return active semesters with success', async () => {
      mockDataSource.query.mockResolvedValue([mockSemester()]);

      const result = await service.getActiveSemesters();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSemester()]);
    });

    it('should query only open and close status', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.getActiveSemesters();

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain("status IN ('open', 'close')");
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.getActiveSemesters()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      inst_id: 1,
      semester: '1/2567',
      start_date: '2024-05-01',
      end_date: '2024-09-30',
      flag_valid: true,
    };

    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(
        service.create({ ...createDto, inst_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when semester is missing', async () => {
      await expect(
        service.create({ ...createDto, semester: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when start_date is missing', async () => {
      await expect(
        service.create({ ...createDto, start_date: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when end_date is missing', async () => {
      await expect(
        service.create({ ...createDto, end_date: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when flag_valid is not boolean', async () => {
      await expect(
        service.create({ ...createDto, flag_valid: undefined as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create semester and return success with data', async () => {
      const created = mockSemester();
      mockSemesterRepo.create.mockReturnValue(created);
      mockSemesterRepo.save.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(result.message).toContain('created');
    });

    it('should default status to pending when not provided', async () => {
      const created = mockSemester({ status: 'pending' });
      mockSemesterRepo.create.mockReturnValue(created);
      mockSemesterRepo.save.mockResolvedValue(created);

      await service.create(createDto);

      expect(mockSemesterRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });

    it('should use provided status when given', async () => {
      const created = mockSemester({ status: 'open' });
      mockSemesterRepo.create.mockReturnValue(created);
      mockSemesterRepo.save.mockResolvedValue(created);

      await service.create({ ...createDto, status: 'open' });

      expect(mockSemesterRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'open' }),
      );
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      mockSemesterRepo.create.mockReturnValue(mockSemester());
      mockSemesterRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other save error', async () => {
      mockSemesterRepo.create.mockReturnValue(mockSemester());
      mockSemesterRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when semester does not exist', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { semester: '2/2567' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester());

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should update semester name and return updated record', async () => {
      const updated = mockSemester({ semester: '2/2567' });
      mockSemesterRepo.findOne
        .mockResolvedValueOnce(mockSemester())
        .mockResolvedValueOnce(updated);
      mockSemesterRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { semester: '2/2567' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
      expect(mockSemesterRepo.update).toHaveBeenCalledWith(
        { semester_id: 1 },
        expect.objectContaining({ semester: '2/2567' }),
      );
    });

    it('should update inst_id', async () => {
      mockSemesterRepo.findOne
        .mockResolvedValueOnce(mockSemester())
        .mockResolvedValueOnce(mockSemester({ inst_id: 2 }));
      mockSemesterRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { inst_id: 2 });

      expect(result.data!.inst_id).toBe(2);
    });

    it('should update start_date and end_date', async () => {
      mockSemesterRepo.findOne
        .mockResolvedValueOnce(mockSemester())
        .mockResolvedValueOnce(
          mockSemester({
            start_date: new Date('2025-01-01'),
            end_date: new Date('2025-06-30'),
          }),
        );
      mockSemesterRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, {
        start_date: '2025-01-01',
        end_date: '2025-06-30',
      });

      expect(result.success).toBe(true);
    });

    it('should update status', async () => {
      mockSemesterRepo.findOne
        .mockResolvedValueOnce(mockSemester())
        .mockResolvedValueOnce(mockSemester({ status: 'close' }));
      mockSemesterRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { status: 'close' });

      expect(result.data!.status).toBe('close');
    });

    it('should update flag_valid to false', async () => {
      mockSemesterRepo.findOne
        .mockResolvedValueOnce(mockSemester())
        .mockResolvedValueOnce(mockSemester({ flag_valid: false }));
      mockSemesterRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { flag_valid: false });

      expect(result.data!.flag_valid).toBe(false);
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester());
      mockSemesterRepo.update.mockRejectedValue({ code: '23505' });

      await expect(service.update(1, { semester: 'dup' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other update error', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester());
      mockSemesterRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(service.update(1, { semester: 'err' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when semester does not exist', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete semester and return success with deleted data', async () => {
      const existing = mockSemester();
      mockSemesterRepo.findOne.mockResolvedValue(existing);
      mockSemesterRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(existing);
      expect(result.message).toContain('deleted');
      expect(mockSemesterRepo.delete).toHaveBeenCalledWith({ semester_id: 1 });
    });

    it('should throw InternalServerErrorException on delete error', async () => {
      mockSemesterRepo.findOne.mockResolvedValue(mockSemester());
      mockSemesterRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createSemesterSubject ─────────────────────────────────────────────────

  describe('createSemesterSubject', () => {
    const validDto = { subject_id: 10, semester_id: 1, flag_valid: true };

    it('should throw BadRequestException when subject_id is missing', async () => {
      await expect(
        service.createSemesterSubject({
          subject_id: 0,
          semester_id: 1,
          flag_valid: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when semester_id is missing', async () => {
      await expect(
        service.createSemesterSubject({
          subject_id: 10,
          semester_id: 0,
          flag_valid: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when flag_valid is not boolean', async () => {
      await expect(
        service.createSemesterSubject({
          subject_id: 10,
          semester_id: 1,
          flag_valid: undefined as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create record and return success with data', async () => {
      const created = mockSubjectNorm();
      mockSemesterSubjectRepo.create.mockReturnValue(created);
      mockSemesterSubjectRepo.save.mockResolvedValue(created);

      const result = await service.createSemesterSubject(validDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(result.message).toContain('created');
      expect(mockSemesterSubjectRepo.create).toHaveBeenCalledWith({
        subject_id: 10,
        semester_id: 1,
        flag_valid: true,
      });
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      mockSemesterSubjectRepo.create.mockReturnValue(mockSubjectNorm());
      mockSemesterSubjectRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.createSemesterSubject(validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other save error', async () => {
      mockSemesterSubjectRepo.create.mockReturnValue(mockSubjectNorm());
      mockSemesterSubjectRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createSemesterSubject(validDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── deleteSemesterSubject ─────────────────────────────────────────────────

  describe('deleteSemesterSubject', () => {
    const validDto = { subject_id: 10, semester_id: 1 };

    it('should throw BadRequestException when subject_id is missing', async () => {
      await expect(
        service.deleteSemesterSubject({ subject_id: 0, semester_id: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when semester_id is missing', async () => {
      await expect(
        service.deleteSemesterSubject({ subject_id: 10, semester_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete record and return success with data', async () => {
      const deleted = mockSubjectNorm();
      mockDataSource.query.mockResolvedValue([deleted]);

      const result = await service.deleteSemesterSubject(validDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(deleted);
      expect(result.message).toContain('deleted');
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM semester_subject_normalize'),
        [10, 1],
      );
    });

    it('should throw NotFoundException when record not found (empty result)', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.deleteSemesterSubject(validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteSemesterSubject(validDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
