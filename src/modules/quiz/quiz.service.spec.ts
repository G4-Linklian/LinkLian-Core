import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { Quiz } from './entities/quiz.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { AiChat } from '../ai-chat/entities/ai-chat.entity';
import { AiService } from '../ai/ai.service';

// ─── Mock Repositories ─────────────────────────────────────────────────────────

const mockQuizRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockAiChatRepo = {
  findOne: jest.fn(),
};

const mockQuizAttemptRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockAiService = {
  quizGeneration: jest.fn(),
};

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('QuizService', () => {
  let service: QuizService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: getRepositoryToken(Quiz), useValue: mockQuizRepo },
        { provide: getRepositoryToken(AiChat), useValue: mockAiChatRepo },
        { provide: getRepositoryToken(QuizAttempt), useValue: mockQuizAttemptRepo },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
    jest.clearAllMocks();
  });

  // ─── generateQuiz ──────────────────────────────────────────────────────────

  describe('generateQuiz', () => {
    const dto = {
      ai_chat_id: 1,
      difficulty: 'medium',
      question_count: 5,
      title: 'Test Quiz',
      mode: 'learning' as const,
    };
    const userId = 42;

    const mockAiChat = {
      ai_chat_id: 1,
      post_content_id: 10,
      chat_title: 'Test Chat',
      flag_valid: true,
    };

    const mockAiResult = {
      data: {
        questions: [
          { question: 'What is 2+2?', answer: '4', choices: ['2', '3', '4', '5'] },
        ],
      },
    };

    const mockSavedQuiz = {
      quiz_id: 1,
      ai_chat_id: 1,
      quiz_detail: mockAiResult.data,
      difficulty: 'medium',
      question_count: 5,
      created_at: new Date(),
      flag_valid: true,
    };

    it('should generate and save a quiz successfully', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockAiChat);
      mockAiService.quizGeneration.mockResolvedValueOnce(mockAiResult);
      mockQuizRepo.create.mockReturnValueOnce(mockSavedQuiz);
      mockQuizRepo.save.mockResolvedValueOnce(mockSavedQuiz);

      const result = await service.generateQuiz(dto, userId);

      expect(mockAiChatRepo.findOne).toHaveBeenCalledWith({
        where: { ai_chat_id: dto.ai_chat_id, user_sys_id: userId },
      });
      expect(mockAiService.quizGeneration).toHaveBeenCalledWith({
        post_content_id: mockAiChat.post_content_id,
        difficulty: dto.difficulty,
        num_questions: dto.question_count,
      });
      expect(mockQuizRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_chat_id: dto.ai_chat_id,
          quiz_detail: mockAiResult.data,
          difficulty: dto.difficulty,
          question_count: dto.question_count,
        }),
      );
      expect(mockQuizRepo.save).toHaveBeenCalledWith(mockSavedQuiz);
      expect(result).toEqual(mockSavedQuiz);
    });

    it('should use aiResult directly when aiResult.data is undefined', async () => {
      const aiResultDirect = { questions: [{ question: 'Q?', answer: 'A', choices: [] }] };
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockAiChat);
      mockAiService.quizGeneration.mockResolvedValueOnce(aiResultDirect);
      mockQuizRepo.create.mockReturnValueOnce({ ...mockSavedQuiz, quiz_detail: aiResultDirect });
      mockQuizRepo.save.mockResolvedValueOnce({ ...mockSavedQuiz, quiz_detail: aiResultDirect });

      const result = await service.generateQuiz(dto, userId);

      expect(mockQuizRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ quiz_detail: aiResultDirect }),
      );
      expect(result.quiz_detail).toEqual(aiResultDirect);
    });

    it('should throw NotFoundException if AI chat not found', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.generateQuiz(dto, userId)).rejects.toThrow(NotFoundException);
      await expect(service.generateQuiz(dto, userId)).rejects.toThrow('AI Chat not found');
    });
  });

  // ─── getQuizByChat ─────────────────────────────────────────────────────────

  describe('getQuizByChat', () => {
    it('should return an array of quizzes ordered by created_at ASC', async () => {
      const mockQuizzes = [
        { quiz_id: 1, ai_chat_id: 3, difficulty: 'easy', question_count: 3 },
        { quiz_id: 2, ai_chat_id: 3, difficulty: 'hard', question_count: 10 },
      ];
      const userId = 42;
      mockAiChatRepo.findOne.mockResolvedValueOnce({ ai_chat_id: 3, user_sys_id: userId });
      mockQuizRepo.find.mockResolvedValueOnce(mockQuizzes);

      const result = await service.getQuizByChat(3, userId);

      expect(mockAiChatRepo.findOne).toHaveBeenCalledWith({
        where: { ai_chat_id: 3, user_sys_id: userId },
      });
      expect(mockQuizRepo.find).toHaveBeenCalledWith({
        where: { ai_chat_id: 3 },
        order: { created_at: 'ASC' },
        select: [
          'quiz_id',
          'ai_chat_id',
          'quiz_detail',
          'difficulty',
          'question_count',
          'mode',
          'quiz_title',
          'created_at',
        ],
      });
      expect(result).toEqual(mockQuizzes);
    });

    it('should return an empty array when no quizzes exist for the chat', async () => {
      const userId = 99;
      mockAiChatRepo.findOne.mockResolvedValueOnce({ ai_chat_id: 99, user_sys_id: userId });
      mockQuizRepo.find.mockResolvedValueOnce([]);

      const result = await service.getQuizByChat(99, userId);

      expect(result).toEqual([]);
    });
  });

  // ─── saveAttempt ───────────────────────────────────────────────────────────

  describe('saveAttempt', () => {
    const dto = { quiz_id: 1, score: 8, total: 10, answers: { q1: 'A', q2: 'B' } };
    const userId = 42;

    const mockAttempt = {
      attempt_id: 1,
      quiz_id: 1,
      user_sys_id: 42,
      score: 8,
      total: 10,
      answers: { q1: 'A', q2: 'B' },
      created_at: new Date(),
      flag_valid: true,
    };

    it('should create and save a quiz attempt', async () => {
      mockQuizAttemptRepo.create.mockReturnValueOnce(mockAttempt);
      mockQuizAttemptRepo.save.mockResolvedValueOnce(mockAttempt);

      const result = await service.saveAttempt(dto, userId);

      expect(mockQuizAttemptRepo.create).toHaveBeenCalledWith({
        quiz_id: dto.quiz_id,
        user_sys_id: userId,
        score: dto.score,
        total: dto.total,
        answers: dto.answers,
      });
      expect(mockQuizAttemptRepo.save).toHaveBeenCalledWith(mockAttempt);
      expect(result).toEqual(mockAttempt);
    });

    it('should default answers to {} when answers is not provided', async () => {
      const dtoWithoutAnswers = { quiz_id: 1, score: 5, total: 10, answers: undefined as any };
      const expectedAttempt = { ...mockAttempt, answers: {} };

      mockQuizAttemptRepo.create.mockReturnValueOnce(expectedAttempt);
      mockQuizAttemptRepo.save.mockResolvedValueOnce(expectedAttempt);

      await service.saveAttempt(dtoWithoutAnswers, userId);

      expect(mockQuizAttemptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ answers: {} }),
      );
    });
  });

  // ─── getUserAttempt ────────────────────────────────────────────────────────

  describe('getUserAttempt', () => {
    it('should return the user attempt for a given quiz', async () => {
      const mockAttempt = {
        attempt_id: 5,
        quiz_id: 1,
        user_sys_id: 42,
        score: 7,
        total: 10,
      };
      mockQuizAttemptRepo.findOne.mockResolvedValueOnce(mockAttempt);

      const result = await service.getUserAttempt(1, 42);

      expect(mockQuizAttemptRepo.findOne).toHaveBeenCalledWith({
        where: { quiz_id: 1, user_sys_id: 42 },
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual(mockAttempt);
    });

    it('should return null when no attempt exists', async () => {
      mockQuizAttemptRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.getUserAttempt(99, 42);

      expect(result).toBeNull();
    });
  });
});
