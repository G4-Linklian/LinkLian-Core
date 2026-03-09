import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProfileService } from './profile.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let dataSource: any;
  let logger: any;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn(),
    };

    const mockLogger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    dataSource = mockDataSource;
    logger = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return high school profile', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            user_sys_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            role_name: 'student',
          },
        ])
        .mockResolvedValueOnce([
          { edu_type: 'high school', level_name: 'ม.6' },
        ])
        .mockResolvedValueOnce([
          { program_name: '1', study_plan: 'Science' },
        ]);

      const result: any = await service.getUserProfile(1);

      expect(result.success).toBe(true);
      expect(result.data.education.type).toBe('high_school');
    });

    it('should return university profile', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            user_sys_id: 1,
            first_name: 'John',
            last_name: 'Doe',
            role_name: 'student',
          },
        ])
        .mockResolvedValueOnce([
          { edu_type: 'university', level_name: 'Year 4' },
        ])
        .mockResolvedValueOnce([{ program_name: 'A' }])
        .mockResolvedValueOnce([{ section_name: 'Sec1' }])
        .mockResolvedValueOnce([
          { department: 'Computer Science', faculty: 'Engineering' },
        ]);

      const result: any = await service.getUserProfile(1);

      expect(result.success).toBe(true);
      expect(result.data.education.type).toBe('university');
    });

    it('should throw NotFound if profile not found', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.getUserProfile(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerError on unexpected error', async () => {
      dataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.getUserProfile(1)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          user_sys_id: 1,
          first_name: 'Jane',
          last_name: 'Doe',
        },
      ]);

      const result: any = await service.updateProfile(1, {
        first_name: 'Jane',
      });

      expect(result.message).toBe('Profile updated successfully');
      expect(result.data.first_name).toBe('Jane');
    });

    it('should throw BadRequest if no fields to update', async () => {
      await expect(service.updateProfile(1, {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFound if user not found', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.updateProfile(1, { first_name: 'A' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerError on unexpected error', async () => {
      dataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateProfile(1, { first_name: 'A' }),
      ).rejects.toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getTeachingSchedule', () => {
    it('should return schedules', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          schedule_id: 1,
          day_of_week: 1,
          start_time: '08:00',
          end_time: '10:00',
          section_name: 'Sec1',
          subject_code: 'CS101',
          subject_name: 'Programming',
          building_name: 'Building A',
          room_number: '101',
        },
      ]);

      const result: any = await service.getTeachingSchedule(1);

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].subjectCode).toBe('CS101');
    });

    it('should throw InternalServerError on error', async () => {
      dataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.getTeachingSchedule(1)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });
});