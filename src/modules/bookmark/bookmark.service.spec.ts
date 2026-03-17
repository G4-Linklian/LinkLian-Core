import { Test, TestingModule } from '@nestjs/testing';
import { BookmarkService } from './bookmark.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import {
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

const mockQuery = jest.fn();

const mockDataSource = {
  query: mockQuery,
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('BookmarkService', () => {
  let service: BookmarkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarkService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<BookmarkService>(BookmarkService);
    jest.clearAllMocks();
  });

  // ─── getBookmarks ──────────────────────────────────────────────────────────

  describe('getBookmarks', () => {
    it('should return bookmarks with default params', async () => {
      const mockBookmarks = [{ bookmark_id: 1, post_id: 10, user_sys_id: 1 }];
      mockQuery.mockResolvedValueOnce(mockBookmarks);

      const result = await service.getBookmarks();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBookmarks);
      expect(result.totalCount).toBe(1);
      expect(result.message).toBe('Bookmarks retrieved successfully');
    });

    it('should filter by userId', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getBookmarks(1);
      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [calledQuery, calledValues] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('b.user_sys_id');
      expect(calledValues).toContain(1);
    });

    it('should filter by postId', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getBookmarks(undefined, 5);
      const [calledQuery, calledValues] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('b.post_id');
      expect(calledValues).toContain(5);
    });

    it('should filter by sectionId', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getBookmarks(undefined, undefined, 3);
      const [calledQuery, calledValues] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('pic.section_id');
      expect(calledValues).toContain(3);
    });

    it('should fallback to safe sortBy if invalid field is given', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getBookmarks(
        undefined,
        undefined,
        undefined,
        true,
        0,
        50,
        'DROP TABLE',
        'ASC',
      );
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('ORDER BY b.saved_at');
    });

    it('should fallback to DESC if invalid sortOrder is given', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getBookmarks(
        undefined,
        undefined,
        undefined,
        true,
        0,
        50,
        'saved_at',
        'ASC',
      );
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('ORDER BY b.saved_at ASC');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getBookmarks()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── toggleBookmark ────────────────────────────────────────────────────────

  describe('toggleBookmark', () => {
    it('should throw BadRequestException if userId is missing', async () => {
      await expect(service.toggleBookmark(0, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if postId is missing', async () => {
      await expect(service.toggleBookmark(1, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create bookmark if it does not exist', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '0' }]) // check → not exists
        .mockResolvedValueOnce([]); // insert

      const result = await service.toggleBookmark(1, 10);

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('created');
      expect(result.message).toBe('Bookmark created successfully');
    });

    it('should remove bookmark if it already exists', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '1' }]) // check → exists
        .mockResolvedValueOnce([]); // delete

      const result = await service.toggleBookmark(1, 10);

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('removed');
      expect(result.message).toBe('Bookmark removed successfully');
    });

    it('should return correct user_sys_id and post_id in response', async () => {
      mockQuery
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      const result = await service.toggleBookmark(5, 99);
      expect(result.data.user_sys_id).toBe(5);
      expect(result.data.post_id).toBe(99);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.toggleBookmark(1, 10)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── deleteBookmark ────────────────────────────────────────────────────────

  describe('deleteBookmark', () => {
    it('should throw BadRequestException if userId is missing', async () => {
      await expect(service.deleteBookmark(0, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if postId is missing', async () => {
      await expect(service.deleteBookmark(1, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete bookmark and return success', async () => {
      mockQuery.mockResolvedValueOnce([{ bookmark_id: 1 }]);

      const result = await service.deleteBookmark(1, 10);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
      expect(result.message).toBe('Bookmark deleted successfully');
    });

    it('should return not found message if bookmark does not exist', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await service.deleteBookmark(1, 10);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(false);
      expect(result.message).toBe('Bookmark not found');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.deleteBookmark(1, 10)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
