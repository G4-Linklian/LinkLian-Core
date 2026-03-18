import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { BullMQService } from 'src/common/bullmq/bullmq.service';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { PostService } from '../social-feed/post/post.service';
import { AiRedisService } from './redis/ai-redis.service';
import { AiChatService } from '../ai-chat/ai-chat.service';

describe('AiService', () => {
  let service: AiService;

  const mockBullmqService = {
    addJob: jest.fn(),
    addJobAndWait: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const mockPostService = {
    searchPostMaster: jest.fn(),
  };

  const mockAiRedisService = {
    getLastActivity: jest.fn(),
    addMessage: jest.fn(),
    setDocsOverview: jest.fn(),
    clearChatSession: jest.fn(),
  };

  const mockAiChatService = {
    searchAiMessages: jest.fn(),
  };

  const mockFetch = jest.fn();

  beforeAll(() => {
    (global as any).fetch = mockFetch;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: BullMQService, useValue: mockBullmqService },
        { provide: AppLogger, useValue: mockLogger },
        { provide: PostService, useValue: mockPostService },
        { provide: AiRedisService, useValue: mockAiRedisService },
        { provide: AiChatService, useValue: mockAiChatService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);

    jest.clearAllMocks();
  });

  describe('clearQaChatSession', () => {
    it('should clear redis session keys and return success payload', async () => {
      mockAiRedisService.clearChatSession.mockResolvedValueOnce(3);

      const result = await service.clearQaChatSession({ ai_chat_id: 11 });

      expect(mockAiRedisService.clearChatSession).toHaveBeenCalledWith(11);
      expect(result).toEqual({
        success: true,
        data: {
          ai_chat_id: 11,
          deleted_keys: 3,
        },
        message: 'QA chat Redis session cleared successfully.',
      });
    });
  });

  describe('quizGeneration', () => {
    it('should return validation error when post_content_id is missing', async () => {
      const result = await service.quizGeneration({
        post_content_id: 0,
        difficulty: 'easy',
        num_questions: 5,
      });

      expect(result).toEqual({
        success: false,
        message: 'post_content_id is required',
      });
    });

    it('should queue quiz generation job when input is valid', async () => {
      mockFetch.mockRejectedValueOnce(new Error('cache miss'));
      mockBullmqService.addJobAndWait.mockResolvedValueOnce({
        success: true,
        data: { quiz: [] },
      });

      const result = await service.quizGeneration({
        post_content_id: 10,
        difficulty: 'medium',
        num_questions: 5,
      });

      expect(mockBullmqService.addJobAndWait).toHaveBeenCalledWith({
        queue: 'quiz_generation_queue',
        job: 'quiz-generation',
        data: {
          post_content_id: 10,
          difficulty: 'medium',
          num_questions: 5,
        },
        timeout: 60_000,
      });
      expect(result).toEqual({
        success: true,
        data: { quiz: [] },
      });
    });
  });

  describe('postSummary', () => {
    it('should return cached summary when available in Azure blob', async () => {
      mockPostService.searchPostMaster.mockResolvedValueOnce({
        data: [
          {
            post_content_id: 20,
            title: 'Hello',
            content: 'World',
            attachment_id: 1,
            file_url: 'https://blob/file.pdf',
            file_type: 'pdf',
            original_name: 'file.pdf',
          },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ final_summary: 'cached-summary' }),
      });

      const result = await service.postSummary({ post_content_id: 20 });

      expect(result).toEqual({
        success: true,
        data: { final_summary: 'cached-summary' },
        message: 'Summary retrieved from cache.',
      });
      expect(mockBullmqService.addJob).not.toHaveBeenCalled();
      expect(mockBullmqService.addJobAndWait).not.toHaveBeenCalled();
    });

    it('should reject multiple pdf attachments', async () => {
      mockPostService.searchPostMaster.mockResolvedValueOnce({
        data: [
          {
            post_content_id: 21,
            title: 'Doc',
            content: 'A',
            attachment_id: 1,
            file_url: 'https://blob/1.pdf',
            file_type: 'pdf',
            original_name: '1.pdf',
          },
          {
            post_content_id: 21,
            title: 'Doc',
            content: 'A',
            attachment_id: 2,
            file_url: 'https://blob/2.pdf',
            file_type: 'pdf',
            original_name: '2.pdf',
          },
        ],
      });

      mockFetch.mockResolvedValueOnce({ ok: false });

      const result = await service.postSummary({ post_content_id: 21 });

      expect(result).toEqual({
        success: false,
        message:
          'Summary generation for posts with multiple PDF attachments is not supported at this time.',
      });
      expect(mockBullmqService.addJob).not.toHaveBeenCalled();
      expect(mockBullmqService.addJobAndWait).not.toHaveBeenCalled();
    });
  });

  describe('qaChat', () => {
    it('should warm cache and return assistant response when chat session is new', async () => {
      mockAiRedisService.getLastActivity.mockResolvedValueOnce(null);
      mockAiChatService.searchAiMessages.mockResolvedValueOnce({
        data: [
          { ai_chat_id: 100, role: 'user', content: 'Q1' },
          { ai_chat_id: 100, role: 'system', content: 'A1' },
        ],
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue({ document_overview: 'overview from blob' }),
      });

      mockBullmqService.addJobAndWait.mockResolvedValueOnce({
        result: 'assistant answer',
      });

      const result = await service.qaChat({
        ai_chat_id: 100,
        post_content_id: 55,
        question: 'What is this?',
      });

      expect(mockAiRedisService.setDocsOverview).toHaveBeenCalledWith(
        100,
        'overview from blob',
      );
      expect(mockAiRedisService.addMessage).toHaveBeenCalledWith(
        100,
        'user',
        'What is this?',
      );
      expect(mockAiRedisService.addMessage).toHaveBeenCalledWith(
        100,
        'system',
        'assistant answer',
      );
      expect(result).toBe('assistant answer');
    });
  });
});
