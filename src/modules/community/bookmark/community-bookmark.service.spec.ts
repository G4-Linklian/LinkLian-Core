import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunityBookmarkService } from './community-bookmark.service';

describe('CommunityBookmarkService', () => {
  let service: CommunityBookmarkService;
  let dataSource: any;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityBookmarkService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CommunityBookmarkService>(CommunityBookmarkService);
    dataSource = mockDataSource;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('toggleBookmark', () => {
    const userId = 1;
    const postId = 1;

    it('should create bookmark when not exists', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ post_commu_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.toggleBookmark(userId, postId);

      expect(result).toEqual({
        success: true,
        action: 'created',
      });
      expect(dataSource.query).toHaveBeenCalledTimes(3);
      expect(dataSource.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO community_bookmark'),
        [userId, postId],
      );
    });

    it('should remove bookmark when exists', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ post_commu_id: 1 }])
        .mockResolvedValueOnce([{ 1: 1 }])
        .mockResolvedValueOnce([]);

      const result = await service.toggleBookmark(userId, postId);

      expect(result).toEqual({
        success: true,
        action: 'removed',
      });
      expect(dataSource.query).toHaveBeenCalledTimes(3);
      expect(dataSource.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('DELETE FROM community_bookmark'),
        [userId, postId],
      );
    });

    it('should throw error when post_commu_id is missing', async () => {
      await expect(service.toggleBookmark(userId, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when post_commu_id is null', async () => {
      await expect(service.toggleBookmark(userId, null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should check post exists before toggle', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.toggleBookmark(userId, postId)).rejects.toThrow(
        BadRequestException,
      );
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT post_commu_id'),
        [postId],
      );
    });

    it('should throw error when post not found', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.toggleBookmark(userId, postId)).rejects.toThrow(
        'Post not found',
      );
    });

    it('should toggle same post multiple times', async () => {
      // First toggle - create
      dataSource.query
        .mockResolvedValueOnce([{ post_commu_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.toggleBookmark(userId, postId);

      // Second toggle - remove
      dataSource.query
        .mockResolvedValueOnce([{ post_commu_id: 1 }])
        .mockResolvedValueOnce([{ 1: 1 }])
        .mockResolvedValueOnce([]);

      await service.toggleBookmark(userId, postId);

      expect(dataSource.query).toHaveBeenCalledTimes(6);
    });
  });

  describe('getMyBookmarks', () => {
    const userId = 1;

    it('should return user bookmarked posts', async () => {
      const expectedBookmarks = [
        {
          post_commu_id: 1,
          content: 'Post 1',
          created_at: '2026-02-14',
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic1.jpg',
        },
        {
          post_commu_id: 2,
          content: 'Post 2',
          created_at: '2026-02-13',
          first_name: 'Jane',
          last_name: 'Smith',
          profile_pic: 'pic2.jpg',
        },
      ];

      dataSource.query.mockResolvedValueOnce(expectedBookmarks);

      const result = await service.getMyBookmarks(userId);

      expect(result).toEqual(expectedBookmarks);
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM community_bookmark cb'),
        [userId],
      );
    });

    it('should return empty array when no bookmarks', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result = await service.getMyBookmarks(userId);

      expect(result).toEqual([]);
    });

    it('should order bookmarks by saved_at DESC', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.getMyBookmarks(userId);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY cb.saved_at DESC'),
        [userId],
      );
    });

    it('should join with post and user tables', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.getMyBookmarks(userId);

      const query = dataSource.query.mock.calls[0][0];
      expect(query).toContain('JOIN post_in_community p');
      expect(query).toContain('JOIN user_sys u');
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

      const result = await service.getMyBookmarks(userId);

      expect(result[0]).toHaveProperty('post_commu_id');
      expect(result[0]).toHaveProperty('content');
      expect(result[0]).toHaveProperty('first_name');
      expect(result[0]).toHaveProperty('last_name');
      expect(result[0]).toHaveProperty('profile_pic');
    });
  });

  describe('checkBookmark', () => {
    const userId = 1;
    const postId = 1;

    it('should return true when bookmark exists', async () => {
      dataSource.query.mockResolvedValueOnce([{ 1: 1 }]);

      const result = await service.checkBookmark(userId, postId);

      expect(result).toEqual({ bookmarked: true });
    });

    it('should return false when bookmark not exists', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result = await service.checkBookmark(userId, postId);

      expect(result).toEqual({ bookmarked: false });
    });

    it('should query with correct parameters', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.checkBookmark(userId, postId);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM community_bookmark'),
        [userId, postId],
      );
    });

    it('should filter by user and post', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.checkBookmark(userId, postId);

      const query = dataSource.query.mock.calls[0][0];
      expect(query).toContain('user_sys_id=$1');
      expect(query).toContain('post_commu_id=$2');
    });

    it('should handle multiple check calls', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.checkBookmark(userId, 1);
      await service.checkBookmark(userId, 2);
      await service.checkBookmark(2, 1);

      expect(dataSource.query).toHaveBeenCalledTimes(3);
    });

    it('should work with different user IDs', async () => {
      dataSource.query.mockResolvedValue([{ 1: 1 }]);

      const result1 = await service.checkBookmark(1, postId);
      const result2 = await service.checkBookmark(2, postId);

      expect(result1).toEqual({ bookmarked: true });
      expect(result2).toEqual({ bookmarked: true });
      expect(dataSource.query).toHaveBeenNthCalledWith(1, expect.any(String), [
        1,
        postId,
      ]);
      expect(dataSource.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        2,
        postId,
      ]);
    });

    it('should work with different post IDs', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.checkBookmark(userId, 1);
      await service.checkBookmark(userId, 2);
      await service.checkBookmark(userId, 3);

      expect(dataSource.query).toHaveBeenCalledTimes(3);
      expect(dataSource.query).toHaveBeenNthCalledWith(1, expect.any(String), [
        userId,
        1,
      ]);
      expect(dataSource.query).toHaveBeenNthCalledWith(2, expect.any(String), [
        userId,
        2,
      ]);
      expect(dataSource.query).toHaveBeenNthCalledWith(3, expect.any(String), [
        userId,
        3,
      ]);
    });
  });

  describe('Integration scenarios', () => {
    const userId = 1;
    const postId = 1;

    it('should support full bookmark workflow', async () => {
      // Check initial state
      dataSource.query.mockResolvedValueOnce([]);
      let result = await service.checkBookmark(userId, postId);
      expect(result.bookmarked).toBe(false);

      // Toggle to create
      dataSource.query
        .mockResolvedValueOnce([{ post_commu_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      result = (await service.toggleBookmark(userId, postId)) as any;
      expect((result as any).action).toBe('created');

      // Check after creation
      dataSource.query.mockResolvedValueOnce([{ 1: 1 }]);
      result = await service.checkBookmark(userId, postId);
      expect(result.bookmarked).toBe(true);

      // Get bookmarks
      dataSource.query.mockResolvedValueOnce([
        {
          post_commu_id: 1,
          content: 'Post',
          created_at: '2026-02-14',
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic.jpg',
        },
      ]);
      const bookmarks = await service.getMyBookmarks(userId);
      expect(bookmarks.length).toBe(1);

      // Toggle to remove
      dataSource.query
        .mockResolvedValueOnce([{ post_commu_id: 1 }])
        .mockResolvedValueOnce([{ 1: 1 }])
        .mockResolvedValueOnce([]);
      result = (await service.toggleBookmark(userId, postId)) as any;
      expect((result as any).action).toBe('removed');
    });
  });
});
