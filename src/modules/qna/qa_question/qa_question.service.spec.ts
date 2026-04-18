import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QALiveService } from './qa_question.service';
import { QAQuestion } from './entities/qa_question.entity';
import { UserSys } from 'src/modules/users/entities/user-sys.entity';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { QnaRedisService } from '../redis/qna-redis.service';
import { BullMQService } from 'src/common/bullmq/bullmq.service';

const mockQAQuestionRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockLogger = {
  error: jest.fn(),
  debug: jest.fn(),
};

const mockRabbitMQService = {
  publish: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockDataSource = {
  getRepository: jest.fn().mockReturnValue(mockUserRepo),
};

const mockQnaRedisService = {
  getQuestion: jest.fn(),
  cacheQuestion: jest.fn(),
  getQuestionList: jest.fn(),
  cacheQuestionList: jest.fn(),
  updateQuestionStatus: jest.fn(),
};

describe('QAQuestion Service', () => {
  let service: QALiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QALiveService,
        { provide: getRepositoryToken(QAQuestion), useValue: mockQAQuestionRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
        { provide: QnaRedisService, useValue: mockQnaRedisService },
        { provide: BullMQService, useValue: { addJob: jest.fn() } },
      ],
    }).compile();

    service = module.get<QALiveService>(QALiveService);
    jest.clearAllMocks();
  });

  describe('findQuestionById', () => {
    it('should return question when found', async () => {
      const mockQuestion = { qa_question_id: 1, question: 'hello', flag_valid: true };
      mockQAQuestionRepo.findOne.mockResolvedValueOnce(mockQuestion);

      const result = await service.findQuestionById(1);

      expect(mockQAQuestionRepo.findOne).toHaveBeenCalledWith({
        where: { qa_question_id: 1, flag_valid: true },
      });
      expect(result).toEqual({ success: true, data: mockQuestion });
    });

    it('should throw NotFoundException when question is not found', async () => {
      mockQAQuestionRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findQuestionById(404)).rejects.toThrow(NotFoundException);
    });
  });

  describe('searchQuestion', () => {
    it('should throw BadRequestException when no search input is provided', async () => {
      await expect(service.searchQuestion({} as any)).rejects.toThrow(BadRequestException);
    });

    it('should return search result from query builder', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndMapOne: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ qa_question_id: 1, is_anonymous: false }]),
      };
      mockQAQuestionRepo.createQueryBuilder.mockReturnValueOnce(queryBuilder);

      const result = await service.searchQuestion({ qa_live_id: 1 } as any);

      expect(mockQAQuestionRepo.createQueryBuilder).toHaveBeenCalledWith('qa_question');
      expect(result).toEqual({
        success: true,
        data: [{ qa_question_id: 1, is_anonymous: false }],
      });
    });
  });

  describe('createQuestion', () => {
    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(service.createQuestion({ qa_live_id: 1 } as any)).rejects.toThrow(BadRequestException);
    });

    it('should create question and publish event', async () => {
      const dto = {
        qa_live_id: 1,
        asker_id: 2,
        is_anonymous: false,
        question: 'What is this?',
        post_id: 10,
        attachment_id: 11,
        slide_number: 5,
      };
      const createdQuestion = { ...dto, qa_question_id: 100, status: 'PENDING', upvote_count: 0, created_at: new Date() };
      const askerInfo = { user_sys_id: 2, first_name: 'John', last_name: 'Doe', profile_pic: null } as UserSys;

      mockQAQuestionRepo.create.mockReturnValueOnce(createdQuestion);
      mockQAQuestionRepo.save.mockResolvedValueOnce(createdQuestion);
      mockUserRepo.findOne.mockResolvedValueOnce(askerInfo);

      const result = await service.createQuestion(dto as any);

      expect(mockQAQuestionRepo.create).toHaveBeenCalled();
      expect(mockQAQuestionRepo.save).toHaveBeenCalledWith(createdQuestion);
      expect(mockRabbitMQService.publish).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: createdQuestion });
    });
  });

  describe('updateQuestion', () => {
    it('should throw NotFoundException when question is not found', async () => {
      mockQAQuestionRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.updateQuestion(999, { status: 'ANSWERED' } as any)).rejects.toThrow(NotFoundException);
    });

    it('should update question and publish update event', async () => {
      const existing = {
        qa_question_id: 1,
        qa_live_id: 1,
        question: 'old',
        status: 'PENDING',
        upvote_count: 0,
        flag_valid: true,
      };
      mockQAQuestionRepo.findOne.mockResolvedValueOnce(existing);
      mockQAQuestionRepo.update.mockResolvedValueOnce({ affected: 1 });

      const result = await service.updateQuestion(1, { status: 'ANSWERED' } as any);

      expect(mockQAQuestionRepo.update).toHaveBeenCalledWith(1, { status: 'ANSWERED' });
      expect(mockRabbitMQService.publish).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'QA Question with ID 1 updated successfully',
      });
    });
  });
});
