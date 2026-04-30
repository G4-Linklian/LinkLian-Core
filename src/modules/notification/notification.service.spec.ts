import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { DataSource } from 'typeorm';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { NotFoundException } from '@nestjs/common';

const mockQuery = jest.fn();

const mockDataSource = { query: mockQuery };

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    mockQuery.mockReset();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  // ─── getNotifications ───────────────────────────────────────────────────────

  describe('getNotifications', () => {
    it('should return notification list with pagination', async () => {
      const rows = [{ notification_id: 1, type: 'COMMENT', is_read: false }];
      mockQuery
        .mockResolvedValueOnce(rows)              // SELECT notifications
        .mockResolvedValueOnce([{ total: '3' }]); // SELECT COUNT

      const result = await service.getNotifications(1, { limit: 10, offset: 0 });

      expect(result.success).toBe(true);
      expect(result.data.notifications).toEqual(rows);
      expect(result.data.total).toBe(3);
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(0);
    });

    it('should pass userId, limit, offset to query', async () => {
      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      await service.getNotifications(42, { limit: 5, offset: 10 });

      expect(mockQuery.mock.calls[0][1]).toEqual([42, 5, 10]);
    });
  });

  // ─── getUnreadCount ─────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockQuery.mockResolvedValueOnce([{ count: '7' }]);

      const result = await service.getUnreadCount(1);

      expect(result.success).toBe(true);
      expect(result.data.unread_count).toBe(7);
    });

    it('should pass userId to query', async () => {
      mockQuery.mockResolvedValueOnce([{ count: '0' }]);

      await service.getUnreadCount(99);

      expect(mockQuery.mock.calls[0][1]).toContain(99);
    });
  });

  // ─── markAsRead ─────────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      mockQuery.mockResolvedValueOnce([{ notification_id: 1 }]);

      const result = await service.markAsRead(1, 1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Notification marked as read');
    });

    it('should throw NotFoundException if notification not found', async () => {
      mockQuery.mockResolvedValueOnce([]); // no rows returned

      await expect(service.markAsRead(1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── registerFCMToken ───────────────────────────────────────────────────────

  describe('registerFCMToken', () => {
    it('should register FCM token successfully', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await service.registerFCMToken(1, 'token-abc', 'android');

      expect(result.success).toBe(true);
      expect(result.message).toBe('FCM token registered');
    });

    it('should pass userId, token, deviceType to query', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await service.registerFCMToken(5, 'my-token', 'ios');

      expect(mockQuery.mock.calls[0][1]).toEqual([5, 'my-token', 'ios']);
    });
  });

  // ─── removeFCMToken ─────────────────────────────────────────────────────────

  describe('removeFCMToken', () => {
    it('should remove FCM token successfully', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await service.removeFCMToken(1, 'token-abc');

      expect(result.success).toBe(true);
      expect(result.message).toBe('FCM token removed');
    });
  });

  // ─── markAllAsRead ──────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockQuery.mockResolvedValueOnce([null, 3]); // [result, rowCount]

      const result = await service.markAllAsRead(1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('All notifications marked as read');
    });

    it('should pass userId to query', async () => {
      mockQuery.mockResolvedValueOnce([null, 0]);

      await service.markAllAsRead(77);

      expect(mockQuery.mock.calls[0][1]).toContain(77);
    });
  });
});