import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { InternalServerErrorException } from '@nestjs/common';
import { GetClassFeedDto } from './dto/feed.dto';

const mockQuery = jest.fn();
const mockDataSource = { query: mockQuery };
const mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };

const mockSchedule = {
  day_of_week: 1,
  start_time: '08:00',
  end_time: '10:00',
  room: { room_location_id: 1, room_number: '101', floor: 1, room_remark: '' },
  building: { building_id: 1, building_name: 'อาคาร A', building_no: 'A' },
};

const mockClassRow = {
  section_id: 1,
  section_name: 'ม.1/1',
  subject_code: 'MATH101',
  subject_name_th: 'คณิตศาสตร์',
  subject_name_en: 'Mathematics',
  learning_area_name: 'คณิตศาสตร์',
  semester: 1,
  student_count: 30,
  display_class_name: 'ม.1/1',
  schedules: [mockSchedule],
};

describe('FeedService', () => {
  let service: FeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
    jest.clearAllMocks();
  });

  // ─── getStudentClassFeed ───────────────────────────────────────────────────

  describe('getStudentClassFeed', () => {
    const dto: GetClassFeedDto = { user_id: 1, semester_id: 2, limit: 10, offset: 0 };

    it('should return student class feed successfully', async () => {
      mockQuery.mockResolvedValueOnce([mockClassRow]);

      const result = await service.getStudentClassFeed(dto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Student class feed retrieved successfully');
      expect(result.data).toEqual([mockClassRow]);
    });

    it('should return empty data when no classes found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getStudentClassFeed(dto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should pass correct params to query', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getStudentClassFeed(dto);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
        dto.user_id, dto.semester_id, dto.limit, dto.offset,
      ]);
    });

    it('should use default limit=10 and offset=0 when not provided', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getStudentClassFeed({ user_id: 1, semester_id: 2 });
      const [, calledValues] = mockQuery.mock.calls[0];
      expect(calledValues[2]).toBe(10);
      expect(calledValues[3]).toBe(0);
    });

    it('should query from enrollment table', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getStudentClassFeed(dto);
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('FROM enrollment en');
    });

    it('should filter by student_id', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getStudentClassFeed(dto);
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('en.student_id');
    });

    it('should return multiple classes', async () => {
      mockQuery.mockResolvedValueOnce([mockClassRow, { ...mockClassRow, section_id: 2 }]);
      const result = await service.getStudentClassFeed(dto);
      expect(result.data).toHaveLength(2);
    });

    it('should include schedules in each class', async () => {
      mockQuery.mockResolvedValueOnce([mockClassRow]);
      const result = await service.getStudentClassFeed(dto);
      expect(result.data[0]).toHaveProperty('schedules');
      expect(result.data[0].schedules).toEqual([mockSchedule]);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getStudentClassFeed(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getTeacherClassFeed ───────────────────────────────────────────────────

  describe('getTeacherClassFeed', () => {
    const dto: GetClassFeedDto = { user_id: 10, semester_id: 2, limit: 10, offset: 0 };
    const mockTeacherRow = { ...mockClassRow, position: 'main_teacher' };

    it('should return teacher class feed successfully', async () => {
      mockQuery.mockResolvedValueOnce([mockTeacherRow]);

      const result = await service.getTeacherClassFeed(dto);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Teacher class feed retrieved successfully');
      expect(result.data).toEqual([mockTeacherRow]);
    });

    it('should return empty data when no sections found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getTeacherClassFeed(dto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should pass correct params to query', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getTeacherClassFeed(dto);
      expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
        dto.user_id, dto.semester_id, dto.limit, dto.offset,
      ]);
    });

    it('should use default limit=10 and offset=0 when not provided', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getTeacherClassFeed({ user_id: 10, semester_id: 2 });
      const [, calledValues] = mockQuery.mock.calls[0];
      expect(calledValues[2]).toBe(10);
      expect(calledValues[3]).toBe(0);
    });

    it('should query from section_educator table', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getTeacherClassFeed(dto);
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('FROM section_educator se');
    });

    it('should filter by educator_id', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getTeacherClassFeed(dto);
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('se.educator_id');
    });

    it('should include position field in result', async () => {
      mockQuery.mockResolvedValueOnce([mockTeacherRow]);
      const result = await service.getTeacherClassFeed(dto);
      expect(result.data[0]).toHaveProperty('position');
      expect(result.data[0].position).toBe('main_teacher');
    });

    it('should return multiple sections', async () => {
      mockQuery.mockResolvedValueOnce([mockTeacherRow, { ...mockTeacherRow, section_id: 2 }]);
      const result = await service.getTeacherClassFeed(dto);
      expect(result.data).toHaveLength(2);
    });

    it('should include schedules in each section', async () => {
      mockQuery.mockResolvedValueOnce([mockTeacherRow]);
      const result = await service.getTeacherClassFeed(dto);
      expect(result.data[0]).toHaveProperty('schedules');
      expect(result.data[0].schedules).toEqual([mockSchedule]);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getTeacherClassFeed(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
