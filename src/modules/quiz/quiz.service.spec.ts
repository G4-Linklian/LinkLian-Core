import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { Quiz } from './entities/quiz.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { AiChat } from '../ai-chat/entities/ai-chat.entity';
import { AiService } from '../ai/ai.service';
import { DataSource } from 'typeorm';

describe('QuizService', () => {
  let service: QuizService;
  let mockQuizRepo: any;
  let mockAiChatRepo: any;
  let mockQuizAttemptRepo: any;
  let mockAiService: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockQuizRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mockAiChatRepo = {
      findOne: jest.fn(),
    };
    mockQuizAttemptRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mockAiService = {
      quizGeneration: jest.fn(),
    };
    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ user_id: 1 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: getRepositoryToken(Quiz), useValue: mockQuizRepo },
        { provide: getRepositoryToken(AiChat), useValue: mockAiChatRepo },
        { provide: getRepositoryToken(QuizAttempt), useValue: mockQuizAttemptRepo },
        { provide: AiService, useValue: mockAiService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
  });

  describe('generateQuiz', () => {
    it('should throw NotFoundException if AI chat not found', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.generateQuiz({ ai_chat_id: 1, difficulty: 'easy', question_count: 1, title: '', mode: 'learning' }, 1)).rejects.toThrow(NotFoundException);
    });
    it('should create and save quiz', async () => {
      const aiChat = { ai_chat_id: 1, post_content_id: 2, user_sys_id: 1 };
      const aiResult = { data: { questions: [] } };
      const quiz = { quiz_id: 1 };
      mockAiChatRepo.findOne.mockResolvedValueOnce(aiChat);
      mockAiService.quizGeneration.mockResolvedValueOnce(aiResult);
      mockQuizRepo.create.mockReturnValueOnce(quiz);
      mockQuizRepo.save.mockResolvedValueOnce(quiz);
      const result = await service.generateQuiz({ ai_chat_id: 1, difficulty: 'easy', question_count: 1, title: '', mode: 'learning' }, 1);
      expect(result).toBe(quiz);
    });
  });

  describe('getQuizByChat', () => {
    it('should throw UnauthorizedException if chat not found', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getQuizByChat(1, 1)).rejects.toThrow(UnauthorizedException);
    });
    it('should return quizzes', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce({ ai_chat_id: 1, user_sys_id: 1 });
      mockQuizRepo.find.mockResolvedValueOnce([{ quiz_id: 1 }]);
      const result = await service.getQuizByChat(1, 1);
      expect(result).toEqual([{ quiz_id: 1 }]);
    });
  });

  describe('saveAttempt', () => {
    it('should create and save attempt', async () => {
      const attempt = { attempt_id: 1 };
      mockQuizAttemptRepo.create.mockReturnValueOnce(attempt);
      mockQuizAttemptRepo.save.mockResolvedValueOnce(attempt);
      const result = await service.saveAttempt({ quiz_id: 1, score: 1, total: 1, answers: {} }, 1);
      expect(result).toBe(attempt);
    });
  });

  describe('getUserAttempt', () => {
    it('should return user attempt', async () => {
      const attempt = { attempt_id: 1 };
      mockQuizAttemptRepo.findOne.mockResolvedValueOnce(attempt);
      const result = await service.getUserAttempt(1, 1);
      expect(result).toBe(attempt);
    });
  });

  describe('checkAnswer', () => {
    it('should throw NotFoundException if quiz not found', async () => {
      mockQuizRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.checkAnswer({ quiz_id: 1, question_index: 0, selected: 'A' }, 1)).rejects.toThrow(NotFoundException);
    });
    it('should throw NotFoundException if chat not found', async () => {
      mockQuizRepo.findOne.mockResolvedValueOnce({ quiz_id: 1, ai_chat_id: 2, mode: 'learning', quiz_detail: { questions: [{}] } });
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.checkAnswer({ quiz_id: 1, question_index: 0, selected: 'A' }, 1)).rejects.toThrow(NotFoundException);
    });
    it('should throw BadRequestException if not learning mode', async () => {
      mockQuizRepo.findOne.mockResolvedValueOnce({ quiz_id: 1, ai_chat_id: 2, mode: 'exam', quiz_detail: { questions: [{}] } });
      mockAiChatRepo.findOne.mockResolvedValueOnce({});
      await expect(service.checkAnswer({ quiz_id: 1, question_index: 0, selected: 'A' }, 1)).rejects.toThrow(BadRequestException);
    });
    it('should throw NotFoundException if quiz structure invalid', async () => {
      mockQuizRepo.findOne.mockResolvedValueOnce({ quiz_id: 1, ai_chat_id: 2, mode: 'learning', quiz_detail: {} });
      mockAiChatRepo.findOne.mockResolvedValueOnce({});
      await expect(service.checkAnswer({ quiz_id: 1, question_index: 0, selected: 'A' }, 1)).rejects.toThrow(NotFoundException);
    });
    it('should throw NotFoundException if question not found', async () => {
      mockQuizRepo.findOne.mockResolvedValueOnce({ quiz_id: 1, ai_chat_id: 2, mode: 'learning', quiz_detail: { questions: [] } });
      mockAiChatRepo.findOne.mockResolvedValueOnce({});
      await expect(service.checkAnswer({ quiz_id: 1, question_index: 0, selected: 'A' }, 1)).rejects.toThrow(NotFoundException);
    });
    it('should return correct answer result', async () => {
      const question = { answer: 'A', explanation: 'exp' };
      mockQuizRepo.findOne.mockResolvedValueOnce({ quiz_id: 1, ai_chat_id: 2, mode: 'learning', quiz_detail: { questions: [question] } });
      mockAiChatRepo.findOne.mockResolvedValueOnce({});
      const result = await service.checkAnswer({ quiz_id: 1, question_index: 0, selected: 'A' }, 1);
      expect(result).toEqual({ correct: true, correct_answer: 'A', explanation: 'exp' });
    });
  });
});
