import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CommunityBookmarkController } from './community-bookmark.controller';
import { CommunityBookmarkService } from './community-bookmark.service';

describe('CommunityBookmarkController', () => {
  let controller: CommunityBookmarkController;
  let service: CommunityBookmarkService;

  beforeEach(async () => {
    const mockService = {
      toggleBookmark: jest.fn(),
      getMyBookmarks: jest.fn(),
      checkBookmark: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityBookmarkController],
      providers: [{ provide: CommunityBookmarkService, useValue: mockService }],
    }).compile();

    controller = module.get<CommunityBookmarkController>(
      CommunityBookmarkController,
    );
    service = module.get<CommunityBookmarkService>(CommunityBookmarkService);
  });

  describe('toggle', () => {
    it('should throw BadRequestException if x-user-id is invalid', async () => {
      const invalidUserId = 'invalid-id';
      const dto = { post_commu_id: 1 };

      await expect(controller.toggle(invalidUserId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if x-user-id is not a number', async () => {
      const invalidUserId = 'abc';
      const dto = { post_commu_id: 1 };

      await expect(controller.toggle(invalidUserId, dto)).rejects.toThrow(
        'Invalid x-user-id',
      );
    });

    it('should throw BadRequestException if x-user-id is empty', async () => {
      const invalidUserId = '';
      const dto = { post_commu_id: 1 };

      await expect(controller.toggle(invalidUserId, dto)).rejects.toThrow(
        'Invalid x-user-id',
      );
    });

    it('should toggle bookmark for post', async () => {
      const userId = '1';
      const postId = 100;
      const dto = { post_commu_id: postId };

      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        success: true,
        action: 'created',
      });

      const result = await controller.toggle(userId, dto);

      expect(service.toggleBookmark).toHaveBeenCalledWith(1, postId);
      expect(result).toHaveProperty('success', true);
    });

    it('should convert userId string to number', async () => {
      const userId = '42';
      const postId = 100;
      const dto = { post_commu_id: postId };

      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        bookmarked: true,
      });

      await controller.toggle(userId, dto);

      const callArgs = (service.toggleBookmark as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(42);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should pass correct postId to service', async () => {
      const userId = '1';
      const postId = 999;
      const dto = { post_commu_id: postId };

      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        bookmarked: true,
      });

      await controller.toggle(userId, dto);

      const callArgs = (service.toggleBookmark as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(999);
    });

    it('should return bookmarked status', async () => {
      const userId = '1';
      const dto = { post_commu_id: 1 };

      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        bookmarked: true,
        post_commu_id: 1,
      });

      const result = await controller.toggle(userId, dto);

      expect(result).toHaveProperty('bookmarked');
    });

    it('should handle toggle create response', async () => {
      const userId = '1';
      const dto = { post_commu_id: 1 };

      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        success: true,
        action: 'added',
      });

      const result = await controller.toggle(userId, dto);

      expect(result.success).toBe(true);
    });

    it('should handle toggle delete response', async () => {
      const userId = '1';
      const dto = { post_commu_id: 1 };

      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        success: true,
        action: 'removed',
      });

      const result = await controller.toggle(userId, dto);

      expect(result.success).toBe(true);
      expect(result.action).toBe('removed');
    });
  });

  describe('myBookmarks', () => {
    it('should throw BadRequestException if x-user-id is invalid', async () => {
      const invalidUserId = 'invalid-id';

      await expect(controller.myBookmarks(invalidUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if x-user-id is not a number', async () => {
      const invalidUserId = 'xyz';

      await expect(controller.myBookmarks(invalidUserId)).rejects.toThrow(
        'Invalid x-user-id',
      );
    });

    it('should throw BadRequestException if x-user-id is empty', async () => {
      const invalidUserId = '';

      await expect(controller.myBookmarks(invalidUserId)).rejects.toThrow(
        'Invalid x-user-id',
      );
    });

    it('should get user bookmarks', async () => {
      const userId = '1';
      const mockBookmarks = [
        {
          post_commu_id: 1,
          content: 'Post 1',
          created_at: new Date(),
          first_name: 'John',
          last_name: 'Doe',
          saved_at: new Date(),
        },
      ];

      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce(
        mockBookmarks,
      );

      const result = await controller.myBookmarks(userId);

      expect(service.getMyBookmarks).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockBookmarks);
    });

    it('should convert userId string to number', async () => {
      const userId = '99';

      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce([]);

      await controller.myBookmarks(userId);

      const callArgs = (service.getMyBookmarks as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(99);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should return array of bookmarks', async () => {
      const userId = '1';
      const mockBookmarks = [
        { post_commu_id: 1, content: 'Post 1' },
        { post_commu_id: 2, content: 'Post 2' },
      ];

      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce(
        mockBookmarks,
      );

      const result = await controller.myBookmarks(userId);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no bookmarks', async () => {
      const userId = '1';

      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce([]);

      const result = await controller.myBookmarks(userId);

      expect(result).toEqual([]);
    });

    it('should include user info in bookmarks', async () => {
      const userId = '1';
      const mockBookmarks = [
        {
          post_commu_id: 1,
          content: 'Post 1',
          first_name: 'Jane',
          last_name: 'Smith',
          profile_pic: 'pic.jpg',
        },
      ];

      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce(
        mockBookmarks,
      );

      const result = await controller.myBookmarks(userId);

      expect(result[0]).toHaveProperty('first_name', 'Jane');
      expect(result[0]).toHaveProperty('profile_pic');
    });
  });

  describe('checkBookmark', () => {
    it('should convert userId string to number', async () => {
      const userId = '5';
      const postId = '100';

      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);

      await controller.checkBookmark(userId, postId);

      const callArgs = (service.checkBookmark as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(5);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should convert postId string to number', async () => {
      const userId = '1';
      const postId = '999';

      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);

      await controller.checkBookmark(userId, postId);

      const callArgs = (service.checkBookmark as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(999);
      expect(typeof callArgs[1]).toBe('number');
    });

    it('should check if post is bookmarked', async () => {
      const userId = '1';
      const postId = '100';

      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);

      const result = await controller.checkBookmark(userId, postId);

      expect(service.checkBookmark).toHaveBeenCalledWith(1, 100);
      expect(result).toBe(true);
    });

    it('should return false if post is not bookmarked', async () => {
      const userId = '1';
      const postId = '100';

      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(false);

      const result = await controller.checkBookmark(userId, postId);

      expect(result).toBe(false);
    });

    it('should return boolean response', async () => {
      const userId = '1';
      const postId = '100';

      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);

      const result = await controller.checkBookmark(userId, postId);

      expect(typeof result).toBe('boolean');
    });

    it('should handle different userId and postId combinations', async () => {
      const userId = '42';
      const postId = '555';

      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);

      await controller.checkBookmark(userId, postId);

      const callArgs = (service.checkBookmark as jest.Mock).mock.calls[0];
      expect(callArgs).toEqual([42, 555]);
    });
  });

  describe('Header validation', () => {
    it('should reject non-numeric userId in toggle', async () => {
      const invalidUserIds = ['abc', 'NaN', 'null', 'undefined', 'test'];

      for (const userId of invalidUserIds) {
        await expect(
          controller.toggle(userId, { post_commu_id: 1 }),
        ).rejects.toThrow('Invalid x-user-id');
      }
    });

    it('should reject non-numeric userId in myBookmarks', async () => {
      const invalidUserIds = ['abc', 'test', 'invalid', 'xyz'];

      for (const userId of invalidUserIds) {
        await expect(controller.myBookmarks(userId)).rejects.toThrow(
          'Invalid x-user-id',
        );
      }
    });

    it('should accept valid numeric string userIds', async () => {
      const validUserIds = ['1', '99', '999', '42'];

      for (const userId of validUserIds) {
        (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
          bookmarked: true,
        });

        try {
          await controller.toggle(userId, { post_commu_id: 1 });
        } catch (e) {
          if (e instanceof BadRequestException) {
            throw e;
          }
        }
      }
    });
  });

  describe('Error handling', () => {
    it('should propagate service errors in toggle', async () => {
      const userId = '1';
      const dto = { post_commu_id: 1 };

      (service.toggleBookmark as jest.Mock).mockRejectedValueOnce(
        new Error('Service error'),
      );

      await expect(controller.toggle(userId, dto)).rejects.toThrow(
        'Service error',
      );
    });

    it('should propagate service errors in myBookmarks', async () => {
      const userId = '1';

      (service.getMyBookmarks as jest.Mock).mockRejectedValueOnce(
        new Error('Service error'),
      );

      await expect(controller.myBookmarks(userId)).rejects.toThrow(
        'Service error',
      );
    });

    it('should propagate service errors in checkBookmark', async () => {
      const userId = '1';
      const postId = '100';

      (service.checkBookmark as jest.Mock).mockRejectedValueOnce(
        new Error('Service error'),
      );

      await expect(controller.checkBookmark(userId, postId)).rejects.toThrow(
        'Service error',
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should toggle bookmark then check its status', async () => {
      const userId = '1';
      const postId = 100;
      const dto = { post_commu_id: postId };

      // Toggle
      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        success: true,
        action: 'created',
      });

      const toggleResult = await controller.toggle(userId, dto);
      expect(toggleResult).toHaveProperty('success', true);

      // Check
      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);

      const checkResult = await controller.checkBookmark(
        userId,
        postId.toString(),
      );
      expect(checkResult).toBe(true);
    });

    it('should get bookmarks and check one of them', async () => {
      const userId = '1';
      const mockBookmarks = [
        { post_commu_id: 1, content: 'Post 1' },
        { post_commu_id: 2, content: 'Post 2' },
      ];

      // Get all bookmarks
      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce(
        mockBookmarks,
      );

      const bookmarks = await controller.myBookmarks(userId);
      expect(bookmarks).toHaveLength(2);

      // Check specific bookmark
      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);

      const isBookmarked = await controller.checkBookmark(
        userId,
        bookmarks[0].post_commu_id.toString(),
      );
      expect(isBookmarked).toBe(true);
    });

    it('should toggle bookmark and get updated bookmarks list', async () => {
      const userId = '1';
      const postId = 100;
      const dto = { post_commu_id: postId };

      // Toggle (add bookmark)
      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        success: true,
        action: 'added',
      });

      const toggleResult = await controller.toggle(userId, dto);
      expect(toggleResult.action).toBe('added');

      // Get updated bookmarks
      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce([
        {
          post_commu_id: postId,
          content: 'Post 100',
          first_name: 'User',
          last_name: 'Name',
        },
      ]);

      const bookmarks = await controller.myBookmarks(userId);
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].post_commu_id).toBe(postId);
    });

    it('should handle multiple bookmark operations', async () => {
      const userId = '1';

      // Toggle post 1
      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        success: true,
      });
      await controller.toggle(userId, { post_commu_id: 1 });

      // Toggle post 2
      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({
        success: true,
      });
      await controller.toggle(userId, { post_commu_id: 2 });

      // Get all bookmarks
      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 1, content: 'Post 1' },
        { post_commu_id: 2, content: 'Post 2' },
      ]);

      const bookmarks = await controller.myBookmarks(userId);
      expect(bookmarks).toHaveLength(2);

      // Check both bookmarks
      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);
      const check1 = await controller.checkBookmark(userId, '1');
      expect(check1).toBe(true);

      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(true);
      const check2 = await controller.checkBookmark(userId, '2');
      expect(check2).toBe(true);
    });
  });

  describe('Data transformation', () => {
    it('should pass correct parameters in toggle', async () => {
      const userId = '10';
      const postId = 200;
      const dto = { post_commu_id: postId };

      (service.toggleBookmark as jest.Mock).mockResolvedValueOnce({});

      await controller.toggle(userId, dto);

      expect(service.toggleBookmark).toHaveBeenCalledWith(10, 200);
    });

    it('should pass correct parameters in myBookmarks', async () => {
      const userId = '15';

      (service.getMyBookmarks as jest.Mock).mockResolvedValueOnce([]);

      await controller.myBookmarks(userId);

      expect(service.getMyBookmarks).toHaveBeenCalledWith(15);
    });

    it('should pass correct parameters in checkBookmark', async () => {
      const userId = '20';
      const postId = '300';

      (service.checkBookmark as jest.Mock).mockResolvedValueOnce(false);

      await controller.checkBookmark(userId, postId);

      expect(service.checkBookmark).toHaveBeenCalledWith(20, 300);
    });
  });
});
