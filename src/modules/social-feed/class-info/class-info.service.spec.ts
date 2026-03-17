import { Test, TestingModule } from '@nestjs/testing';
import { ClassInfoService } from './class-info.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { InternalServerErrorException } from '@nestjs/common';

const mockQuery = jest.fn();

const mockDataSource = { query: mockQuery };

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('ClassInfoService', () => {
  let service: ClassInfoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassInfoService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ClassInfoService>(ClassInfoService);
    jest.clearAllMocks();
  });

  // ─── getSectionEducators ───────────────────────────────────────────────────

  describe('getSectionEducators', () => {
    it('should return educators for a section', async () => {
      const mockEducators = [
        {
          educator_id: 1,
          position: 'main_teacher',
          user_sys_id: 10,
          display_name: 'John Doe',
          email: 'john@test.com',
          profile_pic: null,
        },
      ];
      mockQuery.mockResolvedValueOnce(mockEducators);

      const result = await service.getSectionEducators(1);

      expect(result).toEqual(mockEducators);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('main_teacher'),
        [1],
      );
    });

    it('should return empty array if no educators found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getSectionEducators(99);
      expect(result).toEqual([]);
    });

    it('should only query main_teacher position', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getSectionEducators(1);
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain("position = 'main_teacher'");
    });

    it('should pass sectionId as parameter', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getSectionEducators(42);
      const [, calledValues] = mockQuery.mock.calls[0];
      expect(calledValues).toEqual([42]);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getSectionEducators(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getClassInfo ──────────────────────────────────────────────────────────

  describe('getClassInfo', () => {
    const mockRoom = [
      {
        building_name: 'อาคาร A',
        building_no: 'A',
        room_number: '101',
        floor: '1',
      },
    ];

    const mockSchedules = [
      {
        day_of_week: 1,
        start_time: '08:00',
        end_time: '10:00',
        room: {
          room_location_id: 1,
          room_number: '101',
          floor: '1',
          room_remark: null,
        },
        building: {
          building_id: 1,
          building_name: 'อาคาร A',
          building_no: 'A',
        },
      },
    ];

    const mockMembers = [
      {
        student_id: 1,
        user_sys_id: 100,
        student_code: 'S001',
        display_name: 'Alice Smith',
        profile_pic: null,
      },
    ];

    const mockEducators = [
      {
        educator_id: 1,
        position: 'main_teacher',
        user_sys_id: 10,
        display_name: 'John Doe',
        profile_pic: null,
        is_main_teacher: true,
      },
    ];

    it('should return full class info successfully', async () => {
      mockQuery
        .mockResolvedValueOnce(mockRoom) // roomQuery
        .mockResolvedValueOnce(mockSchedules) // schedulesQuery
        .mockResolvedValueOnce(mockMembers) // membersQuery
        .mockResolvedValueOnce(mockEducators); // educatorsQuery

      const result = await service.getClassInfo(1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Class info fetched successfully');
      expect(result.data).toHaveProperty('room_location');
      expect(result.data).toHaveProperty('schedules');
      expect(result.data).toHaveProperty('members');
      expect(result.data).toHaveProperty('educators');
    });

    it('should build room_location string correctly', async () => {
      mockQuery
        .mockResolvedValueOnce(mockRoom)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getClassInfo(1);
      expect(result.data.room_location).toBe('อาคาร A ห้อง 101 ชั้น 1');
    });

    it('should return empty room_location if no room found', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // no room
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getClassInfo(1);
      expect(result.data.room_location).toBe('');
    });

    it('should build room_location with only building_name if room/floor missing', async () => {
      mockQuery
        .mockResolvedValueOnce([
          {
            building_name: 'อาคาร B',
            building_no: null,
            room_number: null,
            floor: null,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getClassInfo(1);
      expect(result.data.room_location).toBe('อาคาร B');
    });

    it('should return correct schedules', async () => {
      mockQuery
        .mockResolvedValueOnce(mockRoom)
        .mockResolvedValueOnce(mockSchedules)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getClassInfo(1);
      expect(result.data.schedules).toEqual(mockSchedules);
    });

    it('should return correct members', async () => {
      mockQuery
        .mockResolvedValueOnce(mockRoom)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockMembers)
        .mockResolvedValueOnce([]);

      const result = await service.getClassInfo(1);
      expect(result.data.members).toEqual(mockMembers);
    });

    it('should return correct educators', async () => {
      mockQuery
        .mockResolvedValueOnce(mockRoom)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockEducators);

      const result = await service.getClassInfo(1);
      expect(result.data.educators).toEqual(mockEducators);
    });

    it('should return empty arrays when no data found', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getClassInfo(1);
      expect(result.data.schedules).toEqual([]);
      expect(result.data.members).toEqual([]);
      expect(result.data.educators).toEqual([]);
    });

    it('should pass sectionId to all queries', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getClassInfo(7);

      mockQuery.mock.calls.forEach(([, calledValues]) => {
        expect(calledValues).toEqual([7]);
      });
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getClassInfo(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
