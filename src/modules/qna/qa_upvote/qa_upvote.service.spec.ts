import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QALiveService } from './qa_upvote.service';
import { QaQuestionUpvote } from './entities/qa_question_upvote.entity';
import { QAQuestion } from '../qa_question/entities/qa_question.entity';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { QnaRedisService } from '../redis/qna-redis.service';

const mockQaQuestionUpvoteRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockQaQuestionRepo = {
  findOne: jest.fn(),
};

const mockLogger = {
  error: jest.fn(),
  debug: jest.fn(),
};

const mockRabbitMQService = {
  publish: jest.fn(),
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
    increment: jest.fn(),
    decrement: jest.fn(),
    remove: jest.fn(),
    findOne: jest.fn(),
  },
};

const mockDataSource = {
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};

const mockQnaRedisService = {
  cacheQuestion: jest.fn(),
  updateQuestionUpvote: jest.fn(),
};

describe('QAUpvote Service', () => {
  let service: QALiveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QALiveService,
        { provide: getRepositoryToken(QaQuestionUpvote), useValue: mockQaQuestionUpvoteRepo },
        { provide: getRepositoryToken(QAQuestion), useValue: mockQaQuestionRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
        { provide: QnaRedisService, useValue: mockQnaRedisService },
      ],
    }).compile();

    service = module.get<QALiveService>(QALiveService);
    jest.clearAllMocks();
  });

  describe('searchUpvote', () => {
    it('should throw BadRequestException when no search input is provided', async () => {
      await expect(service.searchUpvote({} as any)).rejects.toThrow(BadRequestException);
    });

    it('should return upvote search result', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ qa_question_id: 1, voter_id: 10 }]),
      };
      mockQaQuestionUpvoteRepo.createQueryBuilder.mockReturnValueOnce(queryBuilder);

      const result = await service.searchUpvote({ qa_question_id: 1 } as any);

      expect(mockQaQuestionUpvoteRepo.createQueryBuilder).toHaveBeenCalledWith('qa_question_upvote');
      expect(result).toEqual({
        success: true,
        data: [{ qa_question_id: 1, voter_id: 10 }],
      });
    });
  });

  describe('createUpvote', () => {
    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(service.createUpvote({ voter_id: 1 } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when duplicate upvote exists', async () => {
      mockQaQuestionUpvoteRepo.findOne.mockResolvedValueOnce({ voter_id: 1, qa_question_id: 2 });

      await expect(
        service.createUpvote({ voter_id: 1, qa_question_id: 2 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create upvote, increment count, and publish event', async () => {
      const dto = { voter_id: 1, qa_question_id: 2 };
      const newUpvote = { voter_id: 1, qa_question_id: 2 };
      const updatedQuestion = { qa_live_id: 5, qa_question_id: 2, upvote_count: 3 };

      mockQaQuestionUpvoteRepo.findOne.mockResolvedValueOnce(null);
      mockQueryRunner.manager.create.mockReturnValueOnce(newUpvote);
      mockQueryRunner.manager.save.mockResolvedValueOnce(newUpvote);
      mockQueryRunner.manager.increment.mockResolvedValueOnce({});
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(updatedQuestion);

      const result = await service.createUpvote(dto as any);

      expect(mockQueryRunner.manager.increment).toHaveBeenCalledWith(
        QAQuestion,
        { qa_question_id: 2 },
        'upvote_count',
        1,
      );
      expect(mockRabbitMQService.publish).toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: newUpvote });
    });
  });

  describe('deleteUpvote', () => {
    it('should throw BadRequestException when upvote does not exist', async () => {
      mockQaQuestionUpvoteRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.deleteUpvote({ voter_id: 1, qa_question_id: 2 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete upvote, decrement count, and publish event', async () => {
      const dto = { voter_id: 1, qa_question_id: 2 };
      const existingUpvote = { voter_id: 1, qa_question_id: 2 };
      const updatedQuestion = { qa_live_id: 5, qa_question_id: 2, upvote_count: 2 };

      mockQaQuestionUpvoteRepo.findOne.mockResolvedValueOnce(existingUpvote);
      mockQueryRunner.manager.remove.mockResolvedValueOnce({});
      mockQueryRunner.manager.decrement.mockResolvedValueOnce({});
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(updatedQuestion);

      const result = await service.deleteUpvote(dto as any);

      expect(mockQueryRunner.manager.decrement).toHaveBeenCalledWith(
        QAQuestion,
        { qa_question_id: 2 },
        'upvote_count',
        1,
      );
      expect(mockRabbitMQService.publish).toHaveBeenCalled();
      expect(result).toEqual({ success: true, message: 'Upvote deleted successfully' });
    });
  });
});
