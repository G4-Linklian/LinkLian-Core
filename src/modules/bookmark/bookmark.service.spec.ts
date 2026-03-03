import { Test, TestingModule } from '@nestjs/testing';
import { BookmarkService } from './bookmark.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import {
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';

describe('BookmarkService', () => {
  let service: BookmarkService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockLogger = {
    error: jest.fn(),
  };

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

  describe('getBookmarks', () => {
    it('should return bookmarks successfully', async () => {
      const mockResult = [{ id: 1 }, { id: 2 }];
      mockDataSource.query.mockResolvedValue(mockResult);

      const result = await service.getBookmarks(1);

      expect(result.success).toBe(true);
      expect(result.totalCount).toBe(2);
      expect(result.data).toEqual(mockResult);
      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.getBookmarks(1)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('toggleBookmark', () => {
    it('should create bookmark if not exists', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([]);

      const result = await service.toggleBookmark(1, 100);

      expect(result.data.action).toBe('created');
      expect(result.success).toBe(true);
    });

    it('should remove bookmark if exists', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ count: '1' }]) // checkQuery
        .mockResolvedValueOnce([]); // deleteQuery

      const result = await service.toggleBookmark(1, 100);

      expect(result.data.action).toBe('removed');
      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException if missing params', async () => {
      await expect(service.toggleBookmark(null as any, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.toggleBookmark(1, 100)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('deleteBookmark', () => {
    it('should delete bookmark successfully', async () => {
      mockDataSource.query.mockResolvedValue([{ id: 1 }]);

      const result = await service.deleteBookmark(1, 100);

      expect(result.deleted).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should return not found if bookmark does not exist', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.deleteBookmark(1, 100);

      expect(result.deleted).toBe(false);
      expect(result.message).toBe('Bookmark not found');
    });

    it('should throw BadRequestException if missing params', async () => {
      await expect(service.deleteBookmark(null as any, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteBookmark(1, 100)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
