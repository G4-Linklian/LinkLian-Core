import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunityBookmarkService } from './community-bookmark.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

describe('CommunityBookmarkService', () => {
  let service: CommunityBookmarkService;
  let dataSource: any;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn(),
    };

    const mockLogger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityBookmarkService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CommunityBookmarkService>(
      CommunityBookmarkService,
    );
    dataSource = mockDataSource;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('toggleBookmark', () => {
    const userId = 1;
    const postId = 1;

    const activePostMock = [
      {
        post_commu_id: 1,
        community_id: 1,
        status: 'active',
        is_private: false,
      },
    ];

    it('should create bookmark when not exists', async () => {
      dataSource.query
        .mockResolvedValueOnce(activePostMock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result: any = await service.toggleBookmark(userId, postId);

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('created');
    });

    it('should remove bookmark when exists', async () => {
      dataSource.query
        .mockResolvedValueOnce(activePostMock)
        .mockResolvedValueOnce([{ 1: 1 }])
        .mockResolvedValueOnce([]);

      const result: any = await service.toggleBookmark(userId, postId);

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('removed');
    });

    it('should throw error when post_commu_id is missing', async () => {
      await expect(service.toggleBookmark(userId, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when post_commu_id is null', async () => {
      await expect(
        service.toggleBookmark(userId, null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when post not found', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(
        service.toggleBookmark(userId, postId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should toggle same post multiple times', async () => {
      dataSource.query
        .mockResolvedValueOnce(activePostMock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.toggleBookmark(userId, postId);

      dataSource.query
        .mockResolvedValueOnce(activePostMock)
        .mockResolvedValueOnce([{ 1: 1 }])
        .mockResolvedValueOnce([]);

      await service.toggleBookmark(userId, postId);

      expect(dataSource.query).toHaveBeenCalledTimes(6);
    });
  });

  describe('getMyBookmarks', () => {
    const userId = 1;

    it('should return user bookmarked posts', async () => {
      const bookmarks = [
        {
          post_commu_id: 1,
          content: 'Post 1',
          created_at: '2026-02-14',
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic1.jpg',
        },
      ];

      dataSource.query.mockResolvedValueOnce(bookmarks);

      const result: any = await service.getMyBookmarks(userId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(bookmarks);
    });

    it('should return empty array when no bookmarks', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result: any = await service.getMyBookmarks(userId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should include post details and user info', async () => {
      const bookmarks = [
        {
          post_commu_id: 1,
          content: 'Content',
          created_at: '2026-02-14',
          first_name: 'First',
          last_name: 'Last',
          profile_pic: 'pic.jpg',
        },
      ];

      dataSource.query.mockResolvedValueOnce(bookmarks);

      const result: any = await service.getMyBookmarks(userId);

      expect(result.data[0]).toHaveProperty('post_commu_id');
      expect(result.data[0]).toHaveProperty('content');
      expect(result.data[0]).toHaveProperty('first_name');
      expect(result.data[0]).toHaveProperty('last_name');
      expect(result.data[0]).toHaveProperty('profile_pic');
    });
  });

  describe('checkBookmark', () => {
    const userId = 1;
    const postId = 1;

    it('should return true when bookmark exists', async () => {
      dataSource.query.mockResolvedValueOnce([{ 1: 1 }]);

      const result: any = await service.checkBookmark(userId, postId);

      expect(result.success).toBe(true);
      expect(result.data.bookmarked).toBe(true);
    });

    it('should return false when bookmark not exists', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result: any = await service.checkBookmark(userId, postId);

      expect(result.success).toBe(true);
      expect(result.data.bookmarked).toBe(false);
    });

    it('should work with different user IDs', async () => {
      dataSource.query.mockResolvedValue([{ 1: 1 }]);

      const result1: any = await service.checkBookmark(1, postId);
      const result2: any = await service.checkBookmark(2, postId);

      expect(result1.data.bookmarked).toBe(true);
      expect(result2.data.bookmarked).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    const userId = 1;
    const postId = 1;

    const activePostMock = [
      {
        post_commu_id: 1,
        community_id: 1,
        status: 'active',
        is_private: false,
      },
    ];

    it('should support full bookmark workflow', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      let result: any = await service.checkBookmark(userId, postId);
      expect(result.data.bookmarked).toBe(false);

      dataSource.query
        .mockResolvedValueOnce(activePostMock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      result = await service.toggleBookmark(userId, postId);
      expect(result.data.action).toBe('created');

      dataSource.query.mockResolvedValueOnce([{ 1: 1 }]);
      result = await service.checkBookmark(userId, postId);
      expect(result.data.bookmarked).toBe(true);
    });
  });
});