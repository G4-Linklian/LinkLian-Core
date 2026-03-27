import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiChatService } from './ai-chat.service';
import { AiChat } from './entities/ai-chat.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { AiService } from '../ai/ai.service';

// ─── Mock QueryBuilder ─────────────────────────────────────────────────────────

const mockQb = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
  where: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

// ─── Mock QueryRunner ──────────────────────────────────────────────────────────

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  },
};

// ─── Mock Repos & Services ─────────────────────────────────────────────────────

const mockAiChatRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockAiMessageRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockDataSource = {
  query: jest.fn(),
  createQueryRunner: jest.fn(),
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

const mockAiService = {
  postSummary: jest.fn(),
  qaChat: jest.fn(),
};

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('AiChatService', () => {
  let service: AiChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        { provide: getRepositoryToken(AiChat), useValue: mockAiChatRepo },
        { provide: getRepositoryToken(AiMessage), useValue: mockAiMessageRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
    jest.clearAllMocks();

    // Re-attach chainable mocks after clearAllMocks
    mockAiChatRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockAiMessageRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQb.select.mockReturnThis();
    mockQb.addSelect.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQb.limit.mockReturnThis();
    mockQb.offset.mockReturnThis();
    mockQb.where.mockReturnThis();
    mockQb.getMany.mockReset && mockQb.getMany.mockReset();
  });

  // ─── findAiChatById ────────────────────────────────────────────────────────

  describe('findAiChatById', () => {
    it('should return the chat when found', async () => {
      const mockChat = { ai_chat_id: 1, chat_title: 'Test', flag_valid: true };
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);

      const result = await service.findAiChatById(1);

      expect(result).toEqual({ success: true, data: mockChat });
      expect(mockAiChatRepo.findOne).toHaveBeenCalledWith({
        where: { ai_chat_id: 1 },
      });
    });

    it('should throw NotFoundException when chat not found', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findAiChatById(99)).rejects.toThrow(NotFoundException);
      await expect(service.findAiChatById(99)).rejects.toThrow('AI chat not found');
    });
  });

  // ─── searchAiChat ──────────────────────────────────────────────────────────

  describe('searchAiChat', () => {
    it('should throw BadRequestException when no input provided', async () => {
      await expect(service.searchAiChat({})).rejects.toThrow(BadRequestException);
    });

    it('should return chats filtered by ai_chat_id', async () => {
      const mockChats = [{ ai_chat_id: 1, chat_title: 'Test' }];
      mockQb.getRawMany.mockResolvedValueOnce(mockChats);

      const result = await service.searchAiChat({ ai_chat_id: 1 });

      expect(result).toEqual({ success: true, data: mockChats });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'ac.ai_chat_id = :aiChatId',
        { aiChatId: 1 },
      );
    });

    it('should apply ILIKE filter for chat_title search', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.searchAiChat({ chat_title: 'midterm' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'ac.chat_title ILIKE :chatTitle',
        { chatTitle: '%midterm%' },
      );
    });

    it('should filter by post_content_id', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.searchAiChat({ post_content_id: 10 });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'ac.post_content_id = :postContentId',
        { postContentId: 10 },
      );
    });

    it('should filter by flag_valid', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.searchAiChat({ flag_valid: true });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'ac.flag_valid = :flagValid',
        { flagValid: true },
      );
    });

    it('should throw InternalServerErrorException when query fails', async () => {
      mockQb.getRawMany.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.searchAiChat({ ai_chat_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createAiChat ──────────────────────────────────────────────────────────

  describe('createAiChat', () => {
    const dto = { post_content_id: 10 };

    const mockExistingChat = {
      ai_chat_id: 5,
      chat_title: 'Existing Title',
      summary_text: 'Existing summary',
      post_content_id: 10,
      flag_valid: true,
    };

    it('should return existing chat when one already exists for post_content_id', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockExistingChat);

      const result = await service.createAiChat(dto, 1);

      expect(result.ai_chat_id).toBe(5);
      expect(result.title).toBe('Existing Title');
      expect(mockAiService.postSummary).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when post not found in DB', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);
      mockDataSource.query.mockResolvedValueOnce([]);

      await expect(service.createAiChat(dto, 1)).rejects.toThrow('Post not found');
    });

    it('should throw BadRequestException when AI summary is not ready', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);
      mockDataSource.query.mockResolvedValueOnce([{ title: 'Post', content: 'Content' }]);
      mockAiService.postSummary.mockResolvedValueOnce({ data: {} });

      await expect(service.createAiChat(dto, 1)).rejects.toThrow('AI summary not ready');
    });

    it('should create new chat using final_summary from AI result', async () => {
      const aiResult = { data: { final_summary: 'AI summary text', document_title: 'AI Title' } };
      const savedChat = {
        ai_chat_id: 7,
        chat_title: 'AI Title',
        summary_text: 'AI summary text',
        post_content_id: 10,
      };
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);
      mockDataSource.query.mockResolvedValueOnce([{ title: 'Post', content: 'Content' }]);
      mockAiService.postSummary.mockResolvedValueOnce(aiResult);
      mockAiChatRepo.save.mockResolvedValueOnce(savedChat);

      const result = await service.createAiChat(dto, 1);

      expect(mockAiChatRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ summary_text: 'AI summary text', chat_title: 'AI Title' }),
      );
      expect(result.ai_chat_id).toBe(7);
      expect(result.summary).toBe('AI summary text');
    });

    it('should fallback to post title when AI result has no document_title', async () => {
      const aiResult = { data: { summary: 'Summary text' } };
      const savedChat = {
        ai_chat_id: 8,
        chat_title: 'Post Title',
        summary_text: 'Summary text',
        post_content_id: 10,
      };
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);
      mockDataSource.query.mockResolvedValueOnce([{ title: 'Post Title', content: 'Content' }]);
      mockAiService.postSummary.mockResolvedValueOnce(aiResult);
      mockAiChatRepo.save.mockResolvedValueOnce(savedChat);

      const result = await service.createAiChat(dto, 1);

      expect(result.document_title).toBe('Post Title');
    });
  });

  // ─── updateAiChat ──────────────────────────────────────────────────────────

  describe('updateAiChat', () => {
    const mockChat = { ai_chat_id: 1, chat_title: 'Old', summary_text: 'Old sum', flag_valid: true };

    it('should throw NotFoundException when chat not found', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.updateAiChat(1, { chat_title: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when no fields to update', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);

      await expect(service.updateAiChat(1, {})).rejects.toThrow('No fields to update!');
    });

    it('should update chat_title successfully', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);
      mockAiChatRepo.update.mockResolvedValueOnce({});

      const result = await service.updateAiChat(1, { chat_title: 'New Title' });

      expect(mockAiChatRepo.update).toHaveBeenCalledWith(
        { ai_chat_id: 1 },
        { chat_title: 'New Title' },
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('AI chat updated successfully!');
    });

    it('should update multiple fields at once', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);
      mockAiChatRepo.update.mockResolvedValueOnce({});

      await service.updateAiChat(1, { chat_title: 'New', summary_text: 'New sum', flag_valid: false });

      expect(mockAiChatRepo.update).toHaveBeenCalledWith(
        { ai_chat_id: 1 },
        { chat_title: 'New', summary_text: 'New sum', flag_valid: false },
      );
    });

    it('should throw InternalServerErrorException on update DB error', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);
      mockAiChatRepo.update.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.updateAiChat(1, { chat_title: 'x' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── deleteAiChat ──────────────────────────────────────────────────────────

  describe('deleteAiChat', () => {
    it('should throw NotFoundException when chat not found', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteAiChat(99)).rejects.toThrow(NotFoundException);
    });

    it('should soft-delete (set flag_valid = false) successfully', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce({ ai_chat_id: 1 });
      mockAiChatRepo.update.mockResolvedValueOnce({});

      const result = await service.deleteAiChat(1);

      expect(mockAiChatRepo.update).toHaveBeenCalledWith(
        { ai_chat_id: 1 },
        { flag_valid: false },
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('AI chat deleted successfully!');
    });

    it('should throw InternalServerErrorException on delete DB error', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce({ ai_chat_id: 1 });
      mockAiChatRepo.update.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.deleteAiChat(1)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── searchAiMessages ──────────────────────────────────────────────────────

  describe('searchAiMessages', () => {
    it('should throw BadRequestException when no input provided', async () => {
      await expect(service.searchAiMessages({})).rejects.toThrow(BadRequestException);
    });

    it('should return messages filtered by ai_chat_id', async () => {
      const mockMessages = [{ ai_message_id: '1', ai_chat_id: '2', role: 'user' }];
      mockQb.getRawMany.mockResolvedValueOnce(mockMessages);

      const result = await service.searchAiMessages({ ai_chat_id: 2 });

      expect(result).toEqual({ success: true, data: mockMessages });
      expect(mockQb.andWhere).toHaveBeenCalledWith('am.ai_chat_id = :aiChatId', {
        aiChatId: 2,
      });
    });

    it('should filter by role', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.searchAiMessages({ role: 'system' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('am.role = :role', { role: 'system' });
    });

    it('should apply ILIKE filter for content search', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.searchAiMessages({ content: 'explain' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('am.content ILIKE :content', {
        content: '%explain%',
      });
    });

    it('should throw InternalServerErrorException when query fails', async () => {
      mockQb.getRawMany.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.searchAiMessages({ ai_chat_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createAiMessage ───────────────────────────────────────────────────────

  describe('createAiMessage', () => {
    const dto = { ai_chat_id: 1, question: 'What is this about?', post_content_id: 10 };

    it('should throw NotFoundException when chat not found', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.createAiMessage(dto, 1)).rejects.toThrow(NotFoundException);
      await expect(service.createAiMessage(dto, 1)).rejects.toThrow('AI chat not found');
    });

    it('should create a message and return the AI answer', async () => {
      const mockChat = { ai_chat_id: 1, post_content_id: 10, flag_valid: true };
      const aiAnswer = 'This document covers chapter 3 of algebra.';
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);
      mockAiService.qaChat.mockResolvedValueOnce({ result: aiAnswer });

      // Mock the transaction inside createQaMessagePairTransaction
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockChat);
      mockQueryRunner.manager.create
        .mockReturnValueOnce({ role: 'user', content: dto.question })
        .mockReturnValueOnce({ role: 'system', content: aiAnswer });
      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ ai_message_id: '1', role: 'user' })
        .mockResolvedValueOnce({ ai_message_id: '2', role: 'system' });

      const result = await service.createAiMessage(dto, 1);

      expect(result.success).toBe(true);
      expect(result.data).toBe(aiAnswer);
    });

    it('should throw InternalServerErrorException when AI service throws', async () => {
      const mockChat = { ai_chat_id: 1, post_content_id: 10, flag_valid: true };
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);
      mockAiService.qaChat.mockRejectedValueOnce(new Error('AI service down'));

      await expect(service.createAiMessage(dto, 1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createQaMessagePairTransaction ───────────────────────────────────────

  describe('createQaMessagePairTransaction', () => {
    const aiChatId = 1;
    const userQuestion = 'What is gravity?';
    const assistantAnswer = 'It is a fundamental force.';

    const mockChat = { ai_chat_id: 1, flag_valid: true };
    const savedUser = { ai_message_id: '10', role: 'user', content: userQuestion };
    const savedSystem = { ai_message_id: '11', role: 'system', content: assistantAnswer };

    it('should save user and system messages in a transaction', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockChat);
      mockQueryRunner.manager.create
        .mockReturnValueOnce({ role: 'user', content: userQuestion })
        .mockReturnValueOnce({ role: 'system', content: assistantAnswer });
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(savedUser)
        .mockResolvedValueOnce(savedSystem);

      const result = await service.createQaMessagePairTransaction(
        aiChatId,
        userQuestion,
        assistantAnswer,
      );

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.user_message).toEqual(savedUser);
      expect(result.data.system_message).toEqual(savedSystem);
    });

    it('should throw NotFoundException (re-thrown) when chat not found in transaction', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createQaMessagePairTransaction(aiChatId, userQuestion, assistantAnswer),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should rollback and throw InternalServerErrorException on save error', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(mockChat);
      mockQueryRunner.manager.create
        .mockReturnValueOnce({ role: 'user' })
        .mockReturnValueOnce({ role: 'system' });
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.createQaMessagePairTransaction(aiChatId, userQuestion, assistantAnswer),
      ).rejects.toThrow(InternalServerErrorException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─── deleteAiMessage ───────────────────────────────────────────────────────

  describe('deleteAiMessage', () => {
    it('should throw NotFoundException when message not found', async () => {
      mockAiMessageRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteAiMessage(99)).rejects.toThrow(NotFoundException);
      await expect(service.deleteAiMessage(99)).rejects.toThrow('AI message not found');
    });

    it('should soft-delete (set flag_valid = false) successfully', async () => {
      mockAiMessageRepo.findOne.mockResolvedValueOnce({ ai_message_id: '5' });
      mockAiMessageRepo.update.mockResolvedValueOnce({});

      const result = await service.deleteAiMessage(5);

      expect(mockAiMessageRepo.findOne).toHaveBeenCalledWith({
        where: { ai_message_id: '5' },
      });
      expect(mockAiMessageRepo.update).toHaveBeenCalledWith(
        { ai_message_id: '5' },
        { flag_valid: false },
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('AI message deleted successfully!');
    });

    it('should throw InternalServerErrorException on update DB error', async () => {
      mockAiMessageRepo.findOne.mockResolvedValueOnce({ ai_message_id: '5' });
      mockAiMessageRepo.update.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.deleteAiMessage(5)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── getAiChat ─────────────────────────────────────────────────────────────

  describe('getAiChat', () => {
    it('should throw NotFoundException when chat not found', async () => {
      mockAiChatRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getAiChat(99, 1)).rejects.toThrow(NotFoundException);
      await expect(service.getAiChat(99, 1)).rejects.toThrow('AI chat not found');
    });

    it('should return chat with post data and attachments', async () => {
      const mockChat = {
        ai_chat_id: 1,
        post_content_id: 10,
        chat_title: 'Chapter 1',
        summary_text: 'Summary here',
        flag_valid: true,
      };
      const mockPostData = {
        title: 'Research Paper',
        content: 'Full content...',
        attachments: [{ file_url: 'https://example.com/file.pdf', file_type: 'pdf', original_name: 'file.pdf' }],
      };
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);
      mockDataSource.query.mockResolvedValueOnce([mockPostData]);

      const result = await service.getAiChat(1, 1);

      expect(result.ai_chat_id).toBe(1);
      expect(result.title).toBe('Chapter 1');
      expect(result.summary).toBe('Summary here');
      expect(result.post_title).toBe('Research Paper');
      expect(result.attachments).toEqual(mockPostData.attachments);
    });

    it('should return empty defaults when post data is missing', async () => {
      const mockChat = {
        ai_chat_id: 2,
        post_content_id: 99,
        chat_title: 'Orphan Chat',
        summary_text: 'Some summary',
        flag_valid: true,
      };
      mockAiChatRepo.findOne.mockResolvedValueOnce(mockChat);
      mockDataSource.query.mockResolvedValueOnce([undefined]); // postData[0] is undefined

      const result = await service.getAiChat(2, 1);

      expect(result.post_title).toBe('');
      expect(result.content).toBe('');
      expect(result.attachments).toEqual([]);
    });
  });

  // ─── getAll ────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('should return all valid chats ordered by created_at DESC', async () => {
      const mockChats = [
        { ai_chat_id: 2, chat_title: 'B', flag_valid: true },
        { ai_chat_id: 1, chat_title: 'A', flag_valid: true },
      ];
      mockQb.getMany.mockResolvedValueOnce(mockChats);

      const userId = 123;
      const result = await service.getAll(userId);

      expect(mockQb.getMany).toHaveBeenCalled();
      expect(result).toEqual(mockChats);
    });

    it('should return empty array when no chats exist', async () => {
      mockQb.getMany.mockResolvedValueOnce([]);

      const userId = 456;
      const result = await service.getAll(userId);

      expect(result).toEqual([]);
    });
  });
});
