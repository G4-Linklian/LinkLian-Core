import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SectionService } from './section.service';
import { Section } from './entities/section.entity';
import { SectionSchedule } from './entities/section-schedule.entity';
import { SectionEducator } from './entities/section-educator.entity';
import { Enrollment } from './entities/enrollment.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockSection = (overrides: any = {}) => ({
  section_id: 1,
  subject_id: 10,
  semester_id: 5,
  section_name: 'SEC001',
  flag_valid: true,
  created_at: new Date('2025-01-01'),
  updated_at: new Date('2025-01-01'),
  ...overrides,
});

const mockSchedule = (overrides: any = {}) => ({
  schedule_id: 1,
  section_id: 1,
  day_of_week: '1',
  start_time: '08:00',
  end_time: '10:00',
  room_location_id: 1,
  flag_valid: true,
  ...overrides,
});

const mockEducator = (overrides: any = {}) => ({
  section_id: 1,
  educator_id: 20,
  position: 'main_teacher',
  flag_valid: true,
  ...overrides,
});

const mockEnrollment = (overrides: any = {}) => ({
  section_id: 1,
  student_id: 30,
  flag_valid: true,
  enrolled_at: new Date('2025-01-01'),
  ...overrides,
});

// ─── QueryRunner mock factory ─────────────────────────────────────────────────

const buildQueryRunnerMock = (queryResult: any = []) => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  query: jest.fn().mockResolvedValue(queryResult),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('SectionService', () => {
  let service: SectionService;

  const mockSectionRepo = {
    findOne: jest.fn(),
  };

  const mockScheduleRepo = {};
  const mockEducatorRepo = {};
  const mockEnrollmentRepo = {};

  const mockDataSource = {
    query: jest.fn(),
    createQueryRunner: jest.fn(),
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
        SectionService,
        { provide: getRepositoryToken(Section), useValue: mockSectionRepo },
        {
          provide: getRepositoryToken(SectionSchedule),
          useValue: mockScheduleRepo,
        },
        {
          provide: getRepositoryToken(SectionEducator),
          useValue: mockEducatorRepo,
        },
        {
          provide: getRepositoryToken(Enrollment),
          useValue: mockEnrollmentRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<SectionService>(SectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── searchMaster ──────────────────────────────────────────────────────────

  describe('searchMaster', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.searchMaster({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return results when filtering by section_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSection()]);

      const result = await service.searchMaster({ section_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSection()]);
    });

    it('should return results when filtering by semester_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSection()]);

      const result = await service.searchMaster({ semester_id: 5 });

      expect(result.success).toBe(true);
    });

    it('should return results when filtering by subject_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSection()]);

      await service.searchMaster({ subject_id: 10 });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when filtering by inst_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSection()]);

      await service.searchMaster({ inst_id: 1 });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when filtering by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([mockSection()]);

      await service.searchMaster({ flag_valid: true });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should include student_count subquery when count_student is true', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchMaster({ section_id: 1, count_student: true });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('student_count');
    });

    it('should not include student_count subquery when count_student is false', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchMaster({ section_id: 1, count_student: false });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).not.toContain('student_count');
    });

    it('should include ILIKE when keyword is provided', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchMaster({ section_id: 1, keyword: 'math' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ILIKE');
      expect(values).toContain('%math%');
    });

    it('should apply sort and pagination', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchMaster({
        section_id: 1,
        sort_by: 'section_name',
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

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.searchMaster({ section_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when filtering by section_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSection()]);

      const result = await service.search({ section_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSection()]);
    });

    it('should return results when filtering by schedule_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSection()]);

      const result = await service.search({ schedule_id: 1 });

      expect(result.success).toBe(true);
    });

    it('should return results when filtering by day_of_week', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ day_of_week: '1' });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when filtering by room_location_id', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ room_location_id: 1 });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when filtering by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ flag_valid: false });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should apply sort and pagination', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        section_id: 1,
        sort_by: 'section_name',
        sort_order: 'ASC',
        limit: 5,
        offset: 0,
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('LIMIT');
      expect(values).toContain(5);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.search({ section_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── searchSchedule ────────────────────────────────────────────────────────

  describe('searchSchedule', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.searchSchedule({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return results when filtering by schedule_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSchedule()]);

      const result = await service.searchSchedule({ schedule_id: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockSchedule()]);
    });

    it('should return results when filtering by section_id', async () => {
      mockDataSource.query.mockResolvedValue([mockSchedule()]);

      const result = await service.searchSchedule({ section_id: 1 });

      expect(result.success).toBe(true);
    });

    it('should return results when filtering by day_of_week', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchSchedule({ day_of_week: '1' });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when filtering by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchSchedule({ flag_valid: true });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.searchSchedule({ section_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── searchEducator ────────────────────────────────────────────────────────

  describe('searchEducator', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.searchEducator({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return results when filtering by section_id', async () => {
      mockDataSource.query.mockResolvedValue([mockEducator()]);

      const result = await service.searchEducator({ section_id: 1 });

      expect(result.success).toBe(true);
    });

    it('should return results when filtering by user_sys_id', async () => {
      mockDataSource.query.mockResolvedValue([mockEducator()]);

      await service.searchEducator({ user_sys_id: 20 });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should include profile fields when from_profile is true', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchEducator({ section_id: 1, from_profile: true });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('first_name');
    });

    it('should include building join when join_building and from_profile are true', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchEducator({
        section_id: 1,
        from_profile: true,
        join_building: true,
      });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('building');
    });

    it('should apply sort and pagination', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchEducator({
        section_id: 1,
        sort_by: 'educator_id',
        sort_order: 'DESC',
        limit: 10,
        offset: 0,
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('DESC');
      expect(values).toContain(10);
    });

    it('should return results when filtering by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchEducator({ flag_valid: false });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.searchEducator({ section_id: 1 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── searchEnrollment ──────────────────────────────────────────────────────

  describe('searchEnrollment', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.searchEnrollment({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return results when filtering by section_id', async () => {
      mockDataSource.query.mockResolvedValue([mockEnrollment()]);

      const result = await service.searchEnrollment({ section_id: 1 });

      expect(result.success).toBe(true);
    });

    it('should return results when filtering by user_sys_id', async () => {
      mockDataSource.query.mockResolvedValue([mockEnrollment()]);

      await service.searchEnrollment({ user_sys_id: 30 });

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should include ILIKE when keyword is provided', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchEnrollment({ section_id: 1, keyword: 'john' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ILIKE');
      expect(values).toContain('%john%');
    });

    it('should apply sort and pagination', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.searchEnrollment({
        section_id: 1,
        sort_by: 'first_name',
        sort_order: 'ASC',
        limit: 20,
        offset: 0,
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY');
      expect(values).toContain(20);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.searchEnrollment({ section_id: 1 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── createSection ─────────────────────────────────────────────────────────

  describe('createSection', () => {
    it('should throw BadRequestException when subject_id is missing', async () => {
      await expect(
        service.createSection({ subject_id: 0, semester_id: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when semester_id is missing', async () => {
      await expect(
        service.createSection({ subject_id: 10, semester_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a section and return success with data', async () => {
      const created = mockSection();
      mockDataSource.query.mockResolvedValue([created]);

      const result = await service.createSection({
        subject_id: 10,
        semester_id: 5,
        section_name: 'SEC001',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO section'),
        expect.arrayContaining([10, 5]),
      );
    });

    it('should pass null for section_name when not provided', async () => {
      mockDataSource.query.mockResolvedValue([mockSection()]);

      await service.createSection({ subject_id: 10, semester_id: 5 });

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values[2]).toBeNull();
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createSection({ subject_id: 10, semester_id: 5 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── createSchedule ────────────────────────────────────────────────────────

  describe('createSchedule', () => {
    const validDto = {
      section_id: 1,
      day_of_week: '1',
      start_time: '08:00',
      end_time: '10:00',
      room_location_id: 1,
    };

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.createSchedule({
          section_id: 0,
          day_of_week: '1',
          start_time: '08:00',
          end_time: '10:00',
          room_location_id: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when day_of_week is missing', async () => {
      await expect(
        service.createSchedule({ ...validDto, day_of_week: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a schedule and return success with data', async () => {
      const created = mockSchedule();
      mockDataSource.query.mockResolvedValue([created]);

      const result = await service.createSchedule(validDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO section_schedule'),
        expect.arrayContaining([1, 1, '08:00', '10:00', 1, true]),
      );
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.createSchedule(validDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createSectionSchedule ─────────────────────────────────────────────────

  describe('createSectionSchedule', () => {
    const validDto = {
      subject_id: 10,
      semester_id: 5,
      day_of_week: '1',
      start_time: '08:00',
      end_time: '10:00',
      room_location_id: 1,
    };

    it('should throw BadRequestException when subject_id is missing', async () => {
      await expect(
        service.createSectionSchedule({ subject_id: 0, semester_id: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when semester_id is missing', async () => {
      await expect(
        service.createSectionSchedule({ subject_id: 10, semester_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create section and schedule, commit and release', async () => {
      const section = mockSection();
      const schedule = mockSchedule();
      const qr = buildQueryRunnerMock();
      qr.query
        .mockResolvedValueOnce([section])
        .mockResolvedValueOnce([schedule]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      const result = await service.createSectionSchedule(validDto);

      expect(result.success).toBe(true);
      expect(result.data.section).toEqual(section);
      expect(result.data.schedule).toEqual(schedule);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('should create section only (no schedule fields), schedule should be null', async () => {
      const section = mockSection();
      const qr = buildQueryRunnerMock([section]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      const result = await service.createSectionSchedule({
        subject_id: 10,
        semester_id: 5,
      });

      expect(result.success).toBe(true);
      expect(result.data.section).toEqual(section);
      expect(result.data.schedule).toBeNull();
    });

    it('should rollback and throw InternalServerErrorException on error', async () => {
      const qr = buildQueryRunnerMock();
      qr.query.mockRejectedValue(new Error('DB error'));
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.createSectionSchedule(validDto),
      ).rejects.toThrow(InternalServerErrorException);
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });
  });

  // ─── createEducator ────────────────────────────────────────────────────────

  describe('createEducator', () => {
    const validDto = { section_id: 1, user_sys_id: 20, position: 'main_teacher' };

    it('should throw BadRequestException when section_id is missing', async () => {
      await expect(
        service.createEducator({ section_id: 0, user_sys_id: 20, position: 'main_teacher' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user_sys_id is missing', async () => {
      await expect(
        service.createEducator({ section_id: 1, user_sys_id: 0, position: 'main_teacher' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when position is missing', async () => {
      await expect(
        service.createEducator({ section_id: 1, user_sys_id: 20, position: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create educator and return success with data', async () => {
      const created = mockEducator();
      mockDataSource.query.mockResolvedValue([created]);

      const result = await service.createEducator(validDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO section_educator'),
        expect.arrayContaining([1, 20, 'main_teacher', true]),
      );
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockDataSource.query.mockRejectedValue({ code: '23505' });

      await expect(service.createEducator(validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.createEducator(validDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createEnrollment ──────────────────────────────────────────────────────

  describe('createEnrollment', () => {
    const validDto = { section_id: 1, user_sys_id: 30 };

    it('should throw BadRequestException when section_id is missing', async () => {
      await expect(
        service.createEnrollment({ section_id: 0, user_sys_id: 30 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user_sys_id is missing', async () => {
      await expect(
        service.createEnrollment({ section_id: 1, user_sys_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create enrollment and return success with data', async () => {
      const created = mockEnrollment();
      mockDataSource.query.mockResolvedValue([created]);

      const result = await service.createEnrollment(validDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(created);
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockDataSource.query.mockRejectedValue({ code: '23505' });

      await expect(service.createEnrollment(validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.createEnrollment(validDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── updateSection ─────────────────────────────────────────────────────────

  describe('updateSection', () => {
    it('should throw NotFoundException when section does not exist', async () => {
      mockSectionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateSection(999, { section_name: 'SEC999' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockSectionRepo.findOne.mockResolvedValue(mockSection());

      await expect(service.updateSection(1, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update section_name and return updated data', async () => {
      const updated = mockSection({ section_name: 'SEC999' });
      mockSectionRepo.findOne.mockResolvedValue(mockSection());
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.updateSection(1, {
        section_name: 'SEC999',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE section SET'),
        expect.arrayContaining(['SEC999', 1]),
      );
    });

    it('should update subject_id', async () => {
      mockSectionRepo.findOne.mockResolvedValue(mockSection());
      mockDataSource.query.mockResolvedValue([mockSection({ subject_id: 99 })]);

      const result = await service.updateSection(1, { subject_id: 99 });

      expect(result.success).toBe(true);
    });

    it('should update flag_valid to false', async () => {
      mockSectionRepo.findOne.mockResolvedValue(mockSection());
      mockDataSource.query.mockResolvedValue([
        mockSection({ flag_valid: false }),
      ]);

      const result = await service.updateSection(1, { flag_valid: false });

      expect(result.data.flag_valid).toBe(false);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockSectionRepo.findOne.mockResolvedValue(mockSection());
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateSection(1, { section_name: 'err' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── updateSectionSchedule ─────────────────────────────────────────────────

  describe('updateSectionSchedule', () => {
    it('should throw BadRequestException when section_id is missing', async () => {
      await expect(
        service.updateSectionSchedule({ section_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return no changes when no section or schedule fields provided', async () => {
      const result = await service.updateSectionSchedule({ section_id: 1 });

      expect(result.success).toBe(false);
      expect(result.message).toBe('No changes made');
    });

    it('should update section fields and return success', async () => {
      const updated = mockSection({ section_name: 'NEW' });
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.updateSectionSchedule({
        section_id: 1,
        section_name: 'NEW',
      });

      expect(result.success).toBe(true);
      expect(result.data!.section).toEqual(updated);
    });

    it('should update schedule fields when schedule_id is provided', async () => {
      const updatedSection = mockSection();
      const updatedSchedule = mockSchedule({ day_of_week: '3' });
      mockDataSource.query
        .mockResolvedValueOnce([updatedSection])
        .mockResolvedValueOnce([updatedSchedule]);

      const result = await service.updateSectionSchedule({
        section_id: 1,
        section_name: 'NEW',
        schedule_id: 1,
        day_of_week: '3',
      });

      expect(result.success).toBe(true);
      expect(result.data!.schedule).toEqual(updatedSchedule);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateSectionSchedule({
          section_id: 1,
          section_name: 'err',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── updateEducator ────────────────────────────────────────────────────────

  describe('updateEducator', () => {
    it('should throw BadRequestException when both section_id and user_sys_id are missing', async () => {
      await expect(
        service.updateEducator({ section_id: 0, user_sys_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update educator and return success', async () => {
      const updated = mockEducator({ position: 'co_teacher' });
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.updateEducator({
        section_id: 1,
        user_sys_id: 20,
        position: 'co_teacher',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });

    it('should throw NotFoundException when no records found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(
        service.updateEducator({ section_id: 1, user_sys_id: 20, flag_valid: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockDataSource.query.mockRejectedValue({ code: '23505' });

      await expect(
        service.updateEducator({ section_id: 1, position: 'TA' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on other error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateEducator({ section_id: 1, position: 'TA' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── updateEnrollment ──────────────────────────────────────────────────────

  describe('updateEnrollment', () => {
    it('should throw BadRequestException when both section_id and user_sys_id are missing', async () => {
      await expect(
        service.updateEnrollment({ section_id: 0, user_sys_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update enrollment and return success', async () => {
      const updated = mockEnrollment({ flag_valid: false });
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.updateEnrollment({
        section_id: 1,
        user_sys_id: 30,
        flag_valid: false,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });

    it('should throw NotFoundException when no records found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(
        service.updateEnrollment({ section_id: 1, flag_valid: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate (code 23505)', async () => {
      mockDataSource.query.mockRejectedValue({ code: '23505' });

      await expect(
        service.updateEnrollment({ section_id: 1, user_sys_id: 30 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on other error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateEnrollment({ section_id: 1, user_sys_id: 30 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── deleteSection ─────────────────────────────────────────────────────────

  describe('deleteSection', () => {
    it('should delete section and return success', async () => {
      const deleted = mockSection();
      mockDataSource.query.mockResolvedValue([deleted]);

      const result = await service.deleteSection(1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
      expect(result.data).toEqual(deleted);
    });

    it('should throw NotFoundException when section not found (empty result)', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.deleteSection(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteSection(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── deleteSchedule ────────────────────────────────────────────────────────

  describe('deleteSchedule', () => {
    it('should delete schedule and return success', async () => {
      const deleted = mockSchedule();
      mockDataSource.query.mockResolvedValue([deleted]);

      const result = await service.deleteSchedule(1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
      expect(result.data).toEqual(deleted);
    });

    it('should throw NotFoundException when schedule not found (empty result)', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.deleteSchedule(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteSchedule(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── deleteEducator ────────────────────────────────────────────────────────

  describe('deleteEducator', () => {
    it('should throw BadRequestException when both section_id and user_sys_id are missing', async () => {
      await expect(
        service.deleteEducator({ section_id: 0, user_sys_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete educator and return success', async () => {
      const deleted = mockEducator();
      mockDataSource.query.mockResolvedValue([deleted]);

      const result = await service.deleteEducator({
        section_id: 1,
        user_sys_id: 20,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(deleted);
    });

    it('should throw NotFoundException when no records found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(
        service.deleteEducator({ section_id: 1, user_sys_id: 20 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.deleteEducator({ section_id: 1 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── deleteEnrollment ──────────────────────────────────────────────────────

  describe('deleteEnrollment', () => {
    it('should throw BadRequestException when both section_id and user_sys_id are missing', async () => {
      await expect(
        service.deleteEnrollment({ section_id: 0, user_sys_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete enrollment and return success', async () => {
      const deleted = mockEnrollment();
      mockDataSource.query.mockResolvedValue([deleted]);

      const result = await service.deleteEnrollment({
        section_id: 1,
        user_sys_id: 30,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(deleted);
    });

    it('should throw NotFoundException when no records found', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(
        service.deleteEnrollment({ section_id: 1, user_sys_id: 30 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.deleteEnrollment({ section_id: 1 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
