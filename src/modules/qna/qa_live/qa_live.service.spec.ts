import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QALiveService } from './qa_live.service';
import { QALive } from './entities/qa_live.entity';
import { QALiveLog } from './entities/qa_live_log.entity';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { QnaRedisService } from '../redis/qna-redis.service';

const mockQALiveRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  update: jest.fn(),
};

const mockQALiveLogRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockLogger = {
  error: jest.fn(),
  debug: jest.fn(),
};

const mockRabbitMQService = {
  publish: jest.fn(),
};

const mockQnaRedisService = {
  setActiveSlide: jest.fn(),
  getActiveSlide: jest.fn(),
  clearActiveSlide: jest.fn(),
  invalidateQuestionList: jest.fn(),
};

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

describe('QALiveService', () => {
  let service: QALiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QALiveService,
        { provide: getRepositoryToken(QALive), useValue: mockQALiveRepo },
        { provide: getRepositoryToken(QALiveLog), useValue: mockQALiveLogRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
        { provide: QnaRedisService, useValue: mockQnaRedisService },
      ],
    }).compile();

    service = module.get<QALiveService>(QALiveService);
    jest.clearAllMocks();
  });

  describe('findQALiveById', () => {
    it('should return QA live when found', async () => {
      const mockLive = { qa_live_id: 1, section_id: 10, flag_valid: true };
      mockQALiveRepo.findOne.mockResolvedValueOnce(mockLive);

      const result = await service.findQALiveById(1);

      expect(mockQALiveRepo.findOne).toHaveBeenCalledWith({
        where: { qa_live_id: 1, flag_valid: true },
      });
      expect(result).toEqual({ success: true, data: mockLive });
    });

    it('should throw NotFoundException when QA live is not found', async () => {
      mockQALiveRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findQALiveById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchQALive', () => {
    it('should throw BadRequestException when no search input is provided', async () => {
      await expect(service.searchQALive({} as any)).rejects.toThrow(BadRequestException);
    });

    it('should return search result from query builder', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndMapOne: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ qa_live_id: 1 }]),
      };
      mockQALiveRepo.createQueryBuilder.mockReturnValueOnce(queryBuilder);

      const result = await service.searchQALive({ section_id: 1 } as any);

      expect(mockQALiveRepo.createQueryBuilder).toHaveBeenCalledWith('qa_live');
      expect(result).toEqual({ success: true, data: [{ qa_live_id: 1 }] });
    });
  });

  describe('createQALive', () => {
    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(service.createQALive({ section_id: 1 } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when active QA live already exists', async () => {
      mockQALiveRepo.findOne.mockResolvedValueOnce({ qa_live_id: 1, section_id: 1, status: 'ACTIVE' });

      await expect(
        service.createQALive({ section_id: 1, live_by: 2, post_id: 3, attachment_id: 4, live_title: 'Intro' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create QA live and first log successfully', async () => {
      const dto = { section_id: 1, live_by: 2, post_id: 3, attachment_id: 4, live_title: 'Intro' };
      const savedLive = {
        qa_live_id: 10,
        section_id: 1,
        live_by: 2,
        status: 'ACTIVE',
        started_at: new Date(),
      };

      mockQALiveRepo.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.create
        .mockReturnValueOnce({ section_id: 1, live_by: 2, status: 'ACTIVE' })
        .mockReturnValueOnce({ qa_live_id: 10, post_id: 3, attachment_id: 4 });
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(savedLive)
        .mockResolvedValueOnce({ log_id: 100, qa_live_id: 10 });

      const result = await service.createQALive(dto as any);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockRabbitMQService.publish).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: savedLive });
    });
  });
});
