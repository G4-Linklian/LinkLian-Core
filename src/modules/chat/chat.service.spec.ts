import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ChatService } from './chat.service';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { UserSysChatNormalize } from './entities/user-sys-chat-normalize.entity';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { FileStorageService } from 'src/modules/file-storage/file-storage.service';

// ─── Mock QueryBuilder (used by messageRepo) ──────────────────────────────────

const mockQb = {
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

// ─── Mock QueryRunner ──────────────────────────────────────────────────────────

const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  },
};

// ─── Mock Repos & Services ─────────────────────────────────────────────────────

const mockChatRepo = {
  findOne: jest.fn(),
};

const mockMessageRepo = {
  createQueryBuilder: jest.fn(),
};

const mockUserSysChatNormalizeRepo = {};

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

const mockRabbitMQService = {
  publish: jest.fn(),
};

const mockFileStorageService = {
  uploadFiles: jest.fn(),
};

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Chat), useValue: mockChatRepo },
        { provide: getRepositoryToken(Message), useValue: mockMessageRepo },
        {
          provide: getRepositoryToken(UserSysChatNormalize),
          useValue: mockUserSysChatNormalizeRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
        { provide: RabbitMQService, useValue: mockRabbitMQService },
        { provide: FileStorageService, useValue: mockFileStorageService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();

    // Re-attach chainable mocks after clearAllMocks
    mockMessageRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockQb.select.mockReturnThis();
    mockQb.addSelect.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.orderBy.mockReturnThis();
    mockQb.limit.mockReturnThis();
    mockQb.offset.mockReturnThis();
  });

  // ─── findChatById ──────────────────────────────────────────────────────────

  describe('findChatById', () => {
    it('should return the chat when found', async () => {
      const mockChat = { chat_id: 1, is_ai_chat: false, flag_valid: true };
      mockChatRepo.findOne.mockResolvedValueOnce(mockChat);

      const result = await service.findChatById(1);

      expect(result).toEqual({ success: true, data: mockChat });
      expect(mockChatRepo.findOne).toHaveBeenCalledWith({ where: { chat_id: 1 } });
    });

    it('should throw NotFoundException when chat not found', async () => {
      mockChatRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findChatById(99)).rejects.toThrow(NotFoundException);
      await expect(service.findChatById(99)).rejects.toThrow('Chat not found');
    });
  });

  // ─── searchChat ────────────────────────────────────────────────────────────

  describe('searchChat', () => {
    it('should throw BadRequestException when no input provided', async () => {
      await expect(service.searchChat({})).rejects.toThrow(BadRequestException);
    });

    it('should return chats filtered by chat_id', async () => {
      const mockChats = [{ chat_id: 1, is_ai_chat: false }];
      mockDataSource.query.mockResolvedValueOnce(mockChats);

      const result = await service.searchChat({ chat_id: 1 });

      expect(result).toEqual({ success: true, data: mockChats });
      const [calledQuery, calledValues] = mockDataSource.query.mock.calls[0];
      expect(calledQuery).toContain('c.chat_id');
      expect(calledValues).toContain(1);
    });

    it('should filter by user_sys_id and exclude that user', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);

      await service.searchChat({ user_sys_id: 5 });

      const [calledQuery, calledValues] = mockDataSource.query.mock.calls[0];
      expect(calledQuery).toContain('user_sys_id');
      expect(calledValues).toEqual(expect.arrayContaining([5]));
    });

    it('should filter by is_ai_chat', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);

      await service.searchChat({ is_ai_chat: true });

      const [calledQuery, calledValues] = mockDataSource.query.mock.calls[0];
      expect(calledQuery).toContain('is_ai_chat');
      expect(calledValues).toContain(true);
    });

    it('should filter by flag_valid', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);

      await service.searchChat({ flag_valid: false });

      const [calledQuery, calledValues] = mockDataSource.query.mock.calls[0];
      expect(calledQuery).toContain('flag_valid');
      expect(calledValues).toContain(false);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('DB failure'));

      await expect(service.searchChat({ flag_valid: true })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createChat ────────────────────────────────────────────────────────────

  describe('createChat', () => {
    const dto = { sender_id: 1, receiver_id: 2 };

    it('should throw BadRequestException when sender_id is falsy', async () => {
      await expect(
        service.createChat({ sender_id: 0, receiver_id: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when receiver_id is falsy', async () => {
      await expect(
        service.createChat({ sender_id: 1, receiver_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing chat when one already exists', async () => {
      const existingChat = { chat_id: 10, is_ai_chat: false, flag_valid: true };
      mockDataSource.query.mockResolvedValueOnce([{ chat_id: 10 }]);
      mockChatRepo.findOne.mockResolvedValueOnce(existingChat);

      const result = await service.createChat(dto);

      expect(result.message).toBe('Chat already exists');
      expect(result.data).toEqual(existingChat);
    });

    it('should create a new chat with normalize entries via transaction', async () => {
      const savedChat = { chat_id: 20, is_ai_chat: false, flag_valid: true };
      mockDataSource.query.mockResolvedValueOnce([]); // no existing chat
      mockQueryRunner.manager.create
        .mockReturnValueOnce(savedChat)                        // Chat entity
        .mockReturnValueOnce({ user_sys_id: 1, chat_id: 20 }) // sender normalize
        .mockReturnValueOnce({ user_sys_id: 2, chat_id: 20 }); // receiver normalize
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(savedChat)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await service.createChat(dto);

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Chat created successfully!');
      expect(result.data).toEqual(savedChat);
    });

    it('should rollback and throw InternalServerErrorException on transaction error', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);
      mockQueryRunner.manager.create.mockReturnValueOnce({});
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.createChat(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when checking existing chat fails', async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.createChat(dto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── searchMessages ────────────────────────────────────────────────────────

  describe('searchMessages', () => {
    it('should throw BadRequestException when no input provided', async () => {
      await expect(service.searchMessages({})).rejects.toThrow(BadRequestException);
    });

    it('should return messages filtered by chat_id', async () => {
      const mockMessages = [{ message_id: 1, chat_id: 5, content: 'Hi' }];
      mockQb.getRawMany.mockResolvedValueOnce(mockMessages);

      const result = await service.searchMessages({ chat_id: 5 });

      expect(result).toEqual({ success: true, data: mockMessages });
      expect(mockQb.andWhere).toHaveBeenCalledWith('m.chat_id = :chatId', { chatId: 5 });
    });

    it('should filter by sender_id', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.searchMessages({ sender_id: 3 });

      expect(mockQb.andWhere).toHaveBeenCalledWith('m.sender_id = :senderId', {
        senderId: 3,
      });
    });

    it('should apply ILIKE filter for content search', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.searchMessages({ content: 'hello' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('m.content ILIKE :content', {
        content: '%hello%',
      });
    });

    it('should filter by flag_valid', async () => {
      mockQb.getRawMany.mockResolvedValueOnce([]);

      await service.searchMessages({ flag_valid: true });

      expect(mockQb.andWhere).toHaveBeenCalledWith('m.flag_valid = :flagValid', {
        flagValid: true,
      });
    });

    it('should throw InternalServerErrorException when query fails', async () => {
      mockQb.getRawMany.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.searchMessages({ chat_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createMessage ─────────────────────────────────────────────────────────

  describe('createMessage', () => {
    const dto = { chat_id: 1, sender_id: 2, content: 'Hello' };

    const mockSavedMsg = {
      message_id: 1,
      chat_id: 1,
      sender_id: 2,
      content: 'Hello',
      reply_id: null,
      file: null,
      status: 'SENDED',
      flag_valid: true,
      created_at: new Date(),
    };

    it('should throw BadRequestException when chat_id is falsy', async () => {
      await expect(
        service.createMessage({ chat_id: 0, sender_id: 2, content: 'Hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when sender_id is falsy', async () => {
      await expect(
        service.createMessage({ chat_id: 1, sender_id: 0, content: 'Hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when content is empty', async () => {
      await expect(
        service.createMessage({ chat_id: 1, sender_id: 2, content: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should save message, update chat, and publish to RabbitMQ', async () => {
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockSavedMsg);
      mockQueryRunner.manager.update.mockResolvedValueOnce({});
      mockRabbitMQService.publish.mockResolvedValueOnce(undefined);

      const result = await service.createMessage(dto);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalled();
      expect(mockQueryRunner.manager.update).toHaveBeenCalledWith(
        Chat,
        { chat_id: dto.chat_id },
        expect.objectContaining({ last_messages: dto.content }),
      );
      expect(mockRabbitMQService.publish).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSavedMsg);
    });

    it('should still commit when RabbitMQ publish fails (degraded gracefully)', async () => {
      mockQueryRunner.manager.save.mockResolvedValueOnce(mockSavedMsg);
      mockQueryRunner.manager.update.mockResolvedValueOnce({});
      mockRabbitMQService.publish.mockRejectedValueOnce(new Error('RabbitMQ down'));

      const result = await service.createMessage(dto);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should rollback and throw InternalServerErrorException on DB error', async () => {
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.createMessage(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  // ─── searchUsersForChat ────────────────────────────────────────────────────

  describe('searchUsersForChat', () => {
    const dto = { user_sys_id: 1 };

    it('should throw NotFoundException when user not found', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);

      await expect(service.searchUsersForChat(dto)).rejects.toThrow('User not found');
    });

    it('should throw BadRequestException when role is not in allowed roleMap', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ role_id: 99, inst_id: 1 }]);

      await expect(service.searchUsersForChat(dto)).rejects.toThrow('Role not allowed');
    });

    it.each([
      [2, 4],
      [4, 2],
      [3, 5],
      [5, 3],
    ])(
      'should map role_id %i → target role %i and return matching users',
      async (roleId, targetRole) => {
        const mockUsers = [{ user_sys_id: 10, first_name: 'Jane', last_name: 'Doe' }];
        mockDataSource.query
          .mockResolvedValueOnce([{ role_id: roleId, inst_id: 5 }])
          .mockResolvedValueOnce(mockUsers);

        const result = await service.searchUsersForChat(dto);

        expect(result.success).toBe(true);
        expect(result.data.users).toEqual(mockUsers);
        const [, calledValues] = mockDataSource.query.mock.calls[1];
        expect(calledValues[1]).toBe(targetRole);
      },
    );

    it('should filter by keyword when provided', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ role_id: 4, inst_id: 5 }])
        .mockResolvedValueOnce([]);

      await service.searchUsersForChat({ user_sys_id: 1, keyword: 'สม' });

      const [calledQuery, calledValues] = mockDataSource.query.mock.calls[1];
      expect(calledQuery).toContain('ILIKE');
      expect(calledValues).toEqual(expect.arrayContaining(['%สม%']));
    });

    it('should apply limit when provided', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ role_id: 2, inst_id: 5 }])
        .mockResolvedValueOnce([]);

      await service.searchUsersForChat({ user_sys_id: 1, limit: 5 });

      const [calledQuery, calledValues] = mockDataSource.query.mock.calls[1];
      expect(calledQuery).toContain('LIMIT');
      expect(calledValues).toContain(5);
    });
  });
});
