jest.mock('../core/community.service');

import { Test, TestingModule } from '@nestjs/testing';
import { CommunityPostController } from './community-post.controller';
import { CommunityPostService } from './community-post.service';

describe('CommunityPostController', () => {
  let controller: CommunityPostController;
  let service: CommunityPostService;

  beforeEach(async () => {
    const mockService = {
      createPost: jest.fn(),
      searchPosts: jest.fn(),
      getPosts: jest.fn(),
      deletePost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityPostController],
      providers: [{ provide: CommunityPostService, useValue: mockService }],
    }).compile();

    controller = module.get<CommunityPostController>(CommunityPostController);
    service = module.get<CommunityPostService>(CommunityPostService);
  });

  describe('create', () => {
    it('should create post without files', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Hello world' };

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 100,
      });

      const result = await controller.create(userId, [], dto);

      expect(service.createPost).toHaveBeenCalledWith(1, dto, []);
      expect(result.success).toBe(true);
    });

    it('should create post with single file', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Post with image' };
      const files = [
        {
          fieldname: 'files',
          originalname: 'image.jpg',
          mimetype: 'image/jpeg',
          size: 5000,
        } as Express.Multer.File,
      ];

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 101,
      });

      const result = await controller.create(userId, files, dto);

      expect(service.createPost).toHaveBeenCalledWith(1, dto, files);
      expect(result.post_id).toBe(101);
    });

    it('should create post with multiple files', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Multi file post' };
      const files = [
        {
          originalname: 'img1.jpg',
          mimetype: 'image/jpeg',
        } as Express.Multer.File,
        {
          originalname: 'img2.png',
          mimetype: 'image/png',
        } as Express.Multer.File,
      ];

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 102,
      });

      const result = await controller.create(userId, files, dto);

      expect(service.createPost).toHaveBeenCalledWith(1, dto, files);
      expect(result.post_id).toBe(102);
    });

    it('should convert userId string to number', async () => {
      const userId = '42';
      const dto = { community_id: 5, content: 'test' };

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.create(userId, [], dto);

      const callArgs = (service.createPost as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(42);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should pass dto to service', async () => {
      const userId = '1';
      const dto = { community_id: 99, content: 'Special community' };

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.create(userId, [], dto);

      const callArgs = (service.createPost as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toEqual(dto);
    });

    it('should return post creation response', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'My post' };

      const mockResponse = {
        success: true,
        post_id: 100,
        created_at: new Date(),
      };

      (service.createPost as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await controller.create(userId, [], dto);

      expect(result).toEqual(mockResponse);
      expect(result).toHaveProperty('post_id', 100);
    });

    it('should handle service errors', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'test' };

      (service.createPost as jest.Mock).mockRejectedValueOnce(
        new Error('Creation failed'),
      );

      await expect(controller.create(userId, [], dto)).rejects.toThrow(
        'Creation failed',
      );
    });

    it('should handle empty files array', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'No files' };
      const files = [];

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.create(userId, files, dto);

      expect(service.createPost).toHaveBeenCalledWith(1, dto, files);
    });
  });

  describe('search', () => {
    it('should search posts successfully', async () => {
      const userId = '1';
      const communityId = 5;
      const keyword = 'javascript';

      const mockResults = [
        {
          post_commu_id: 100,
          content: 'JavaScript tips',
          first_name: 'John',
        },
      ];

      (service.searchPosts as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await controller.search(userId, communityId, keyword);

      expect(service.searchPosts).toHaveBeenCalledWith(1, 5, keyword, 50);
      expect(result).toEqual(mockResults);
    });

    it('should convert userId to number', async () => {
      const userId = '99';
      const communityId = 5;
      const keyword = 'search';

      (service.searchPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.search(userId, communityId, keyword);

      const callArgs = (service.searchPosts as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(99);
    });

    it('should use default limit of 50', async () => {
      const userId = '1';
      const communityId = 5;
      const keyword = 'test';

      (service.searchPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.search(userId, communityId, keyword);

      const callArgs = (service.searchPosts as jest.Mock).mock.calls[0];
      expect(callArgs[3]).toBe(50);
    });

    it('should use custom limit if provided', async () => {
      const userId = '1';
      const communityId = 5;
      const keyword = 'test';
      const limit = 100;

      (service.searchPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.search(userId, communityId, keyword, limit);

      const callArgs = (service.searchPosts as jest.Mock).mock.calls[0];
      expect(callArgs[3]).toBe(100);
    });

    it('should pass keyword correctly', async () => {
      const userId = '1';
      const communityId = 5;
      const keyword = 'nestjs';

      (service.searchPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.search(userId, communityId, keyword);

      const callArgs = (service.searchPosts as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe('nestjs');
    });

    it('should return empty array if no results', async () => {
      const userId = '1';
      const communityId = 5;
      const keyword = 'nonexistent';

      (service.searchPosts as jest.Mock).mockResolvedValueOnce([]);

      const result = await controller.search(userId, communityId, keyword);

      expect(result).toEqual([]);
    });

    it('should handle search errors', async () => {
      const userId = '1';
      const communityId = 5;
      const keyword = 'test';

      (service.searchPosts as jest.Mock).mockRejectedValueOnce(
        new Error('Search failed'),
      );

      await expect(
        controller.search(userId, communityId, keyword),
      ).rejects.toThrow('Search failed');
    });

    it('should support multiple search results', async () => {
      const userId = '1';
      const communityId = 5;
      const keyword = 'post';

      const mockResults = [
        { post_commu_id: 100, content: 'First post' },
        { post_commu_id: 101, content: 'Second post' },
        { post_commu_id: 102, content: 'Third post' },
      ];

      (service.searchPosts as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await controller.search(userId, communityId, keyword);

      expect(result).toHaveLength(3);
    });
  });

  describe('getPosts', () => {
    it('should get posts successfully', async () => {
      const userId = '1';
      const communityId = 5;

      const mockPosts = [
        { post_commu_id: 100, content: 'Post 1' },
        { post_commu_id: 101, content: 'Post 2' },
      ];

      (service.getPosts as jest.Mock).mockResolvedValueOnce(mockPosts);

      const result = await controller.getPosts(
        userId,
        communityId,
        20,
        0,
        'newest',
      );

      expect(service.getPosts).toHaveBeenCalledWith(1, 5, 20, 0, 'newest');
      expect(result).toEqual(mockPosts);
    });

    it('should convert userId to number', async () => {
      const userId = '77';
      const communityId = 5;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(77);
    });

    it('should convert communityId to number', async () => {
      const userId = '1';
      const communityId = 99;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(99);
    });

    it('should use default limit of 20', async () => {
      const userId = '1';
      const communityId = 5;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe(20);
    });

    it('should use custom limit if provided', async () => {
      const userId = '1';
      const communityId = 5;
      const limit = 50;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, limit, 0, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe(50);
    });

    it('should use default offset of 0', async () => {
      const userId = '1';
      const communityId = 5;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[3]).toBe(0);
    });

    it('should use custom offset if provided', async () => {
      const userId = '1';
      const communityId = 5;
      const offset = 100;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, offset, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[3]).toBe(100);
    });

    it('should use default sort of newest', async () => {
      const userId = '1';
      const communityId = 5;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[4]).toBe('newest');
    });

    it('should use custom sort if provided', async () => {
      const userId = '1';
      const communityId = 5;
      const sort = 'oldest';

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, sort);

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[4]).toBe('oldest');
    });

    it('should handle multiple posts', async () => {
      const userId = '1';
      const communityId = 5;

      const mockPosts = [
        { post_commu_id: 100, content: 'Post 1' },
        { post_commu_id: 101, content: 'Post 2' },
        { post_commu_id: 102, content: 'Post 3' },
      ];

      (service.getPosts as jest.Mock).mockResolvedValueOnce(mockPosts);

      const result = await controller.getPosts(
        userId,
        communityId,
        20,
        0,
        'newest',
      );

      expect(result).toHaveLength(3);
    });

    it('should return empty array if no posts', async () => {
      const userId = '1';
      const communityId = 999;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      const result = await controller.getPosts(
        userId,
        communityId,
        20,
        0,
        'newest',
      );

      expect(result).toEqual([]);
    });

    it('should handle pagination', async () => {
      const userId = '1';
      const communityId = 5;
      const limit = 10;
      const offset = 20;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, limit, offset, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe(10);
      expect(callArgs[3]).toBe(20);
    });

    it('should handle sorting', async () => {
      const userId = '1';
      const communityId = 5;
      const sort = 'oldest';

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, sort);

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[4]).toBe('oldest');
    });

    it('should handle service errors', async () => {
      const userId = '1';
      const communityId = 5;

      (service.getPosts as jest.Mock).mockRejectedValueOnce(
        new Error('Fetch failed'),
      );

      await expect(
        controller.getPosts(userId, communityId, 20, 0, 'newest'),
      ).rejects.toThrow('Fetch failed');
    });
  });

  describe('deletePost', () => {
    it('should delete post successfully', async () => {
      const userId = '1';
      const postId = '100';

      (service.deletePost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const result = await controller.deletePost(userId, postId);

      expect(service.deletePost).toHaveBeenCalledWith(1, 100);
      expect(result.success).toBe(true);
    });

    it('should convert userId to number', async () => {
      const userId = '55';
      const postId = '100';

      (service.deletePost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.deletePost(userId, postId);

      const callArgs = (service.deletePost as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(55);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should convert postId to number', async () => {
      const userId = '1';
      const postId = '999';

      (service.deletePost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.deletePost(userId, postId);

      const callArgs = (service.deletePost as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(999);
      expect(typeof callArgs[1]).toBe('number');
    });

    it('should return deletion response', async () => {
      const userId = '1';
      const postId = '100';

      const mockResponse = { success: true, deleted_at: new Date() };

      (service.deletePost as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await controller.deletePost(userId, postId);

      expect(result).toEqual(mockResponse);
    });

    it('should handle forbidden error', async () => {
      const userId = '1';
      const postId = '100';

      (service.deletePost as jest.Mock).mockRejectedValueOnce(
        new Error('Not allowed'),
      );

      await expect(controller.deletePost(userId, postId)).rejects.toThrow(
        'Not allowed',
      );
    });

    it('should handle post not found error', async () => {
      const userId = '1';
      const postId = '999';

      (service.deletePost as jest.Mock).mockRejectedValueOnce(
        new Error('Post not found'),
      );

      await expect(controller.deletePost(userId, postId)).rejects.toThrow(
        'Post not found',
      );
    });
  });

  describe('Parameter conversion', () => {
    it('should convert all numeric strings in create', async () => {
      const userId = '111';
      const dto = { community_id: 222, content: 'test' };

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.create(userId, [], dto);

      const callArgs = (service.createPost as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(111);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should convert all numeric strings in search', async () => {
      const userId = '123';
      const communityId = 456;
      const keyword = 'test';

      (service.searchPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.search(userId, communityId, keyword);

      const callArgs = (service.searchPosts as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(123);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should convert all numeric strings in deletePost', async () => {
      const userId = '789';
      const postId = '456';

      (service.deletePost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.deletePost(userId, postId);

      const callArgs = (service.deletePost as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(789);
      expect(callArgs[1]).toBe(456);
    });

    it('should handle large numeric IDs', async () => {
      const userId = '999999';
      const postId = '888888';

      (service.deletePost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.deletePost(userId, postId);

      const callArgs = (service.deletePost as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(999999);
      expect(callArgs[1]).toBe(888888);
    });
  });

  describe('Integration scenarios', () => {
    it('should search then get posts in community', async () => {
      const userId = '1';
      const communityId = 5;

      // Search
      (service.searchPosts as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 100, content: 'JavaScript tips' },
      ]);

      const searchResult = await controller.search(
        userId,
        communityId,
        'javascript',
      );
      expect(searchResult).toHaveLength(1);

      // Get all posts
      (service.getPosts as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 100, content: 'JavaScript tips' },
        { post_commu_id: 101, content: 'Python tips' },
      ]);

      const allPosts = await controller.getPosts(
        userId,
        communityId,
        20,
        0,
        'newest',
      );

      expect(allPosts).toHaveLength(2);
    });

    it('should create and then delete post', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Temporary post' };

      // Create
      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 100,
      });

      const createResult = await controller.create(userId, [], dto);
      expect(createResult.post_id).toBe(100);

      // Delete
      (service.deletePost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const deleteResult = await controller.deletePost(userId, '100');
      expect(deleteResult.success).toBe(true);
    });

    it('should create with files and search created post', async () => {
      const userId = '1';
      const communityId = 5;
      const dto = { community_id: communityId, content: 'Post with document' };
      const files = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
        } as Express.Multer.File,
      ];

      // Create
      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 100,
      });

      const createResult = await controller.create(userId, files, dto);
      expect(createResult.success).toBe(true);

      // Search
      (service.searchPosts as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 100, content: 'Post with document' },
      ]);

      const searchResult = await controller.search(
        userId,
        communityId,
        'document',
      );
      expect(searchResult).toHaveLength(1);
    });

    it('should get posts with pagination then delete one', async () => {
      const userId = '1';
      const communityId = 5;

      // Get posts
      (service.getPosts as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 100, content: 'Post 1' },
        { post_commu_id: 101, content: 'Post 2' },
      ]);

      const posts = await controller.getPosts(
        userId,
        communityId,
        20,
        0,
        'newest',
      );
      expect(posts).toHaveLength(2);

      // Delete one
      (service.deletePost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const deleteResult = await controller.deletePost(userId, '100');
      expect(deleteResult.success).toBe(true);
    });

    it('should handle multiple operations in sequence', async () => {
      const userId = '1';
      const communityId = 5;

      // Create first post
      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 100,
      });

      await controller.create(userId, [], {
        community_id: communityId,
        content: 'First post',
      });

      // Create second post
      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 101,
      });

      await controller.create(userId, [], {
        community_id: communityId,
        content: 'Second post',
      });

      // Search
      (service.searchPosts as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 100 },
        { post_commu_id: 101 },
      ]);

      const searchResult = await controller.search(userId, communityId, 'post');
      expect(searchResult).toHaveLength(2);

      // Delete first
      (service.deletePost as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.deletePost(userId, '100');

      expect(service.createPost).toHaveBeenCalledTimes(2);
      expect(service.deletePost).toHaveBeenCalledTimes(1);
    });
  });

  describe('File upload scenarios', () => {
    it('should handle single file upload', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Image post' };
      const files = [
        {
          fieldname: 'files',
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 102400,
        } as Express.Multer.File,
      ];

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 100,
      });

      const result = await controller.create(userId, files, dto);

      expect(service.createPost).toHaveBeenCalledWith(1, dto, files);
      expect(result.success).toBe(true);
    });

    it('should handle multiple file upload', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Gallery' };
      const files = [
        {
          originalname: 'pic1.jpg',
          mimetype: 'image/jpeg',
        } as Express.Multer.File,
        {
          originalname: 'pic2.png',
          mimetype: 'image/png',
        } as Express.Multer.File,
        {
          originalname: 'pic3.gif',
          mimetype: 'image/gif',
        } as Express.Multer.File,
      ];

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 102,
      });

      const result = await controller.create(userId, files, dto);

      expect(result.success).toBe(true);
    });

    it('should handle video file upload', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Video post' };
      const files = [
        {
          originalname: 'video.mp4',
          mimetype: 'video/mp4',
        } as Express.Multer.File,
      ];

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 103,
      });

      await controller.create(userId, files, dto);

      expect(service.createPost).toHaveBeenCalledWith(1, dto, files);
    });

    it('should handle empty files array', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Text only post' };
      const files = [];

      (service.createPost as jest.Mock).mockResolvedValueOnce({
        success: true,
        post_id: 104,
      });

      await controller.create(userId, files, dto);

      expect(service.createPost).toHaveBeenCalledWith(1, dto, files);
    });
  });

  describe('Error handling', () => {
    it('should propagate create errors', async () => {
      const userId = '1';
      const dto = { community_id: 5, content: 'Post' };

      (service.createPost as jest.Mock).mockRejectedValueOnce(
        new Error('Create failed'),
      );

      await expect(controller.create(userId, [], dto)).rejects.toThrow(
        'Create failed',
      );
    });

    it('should propagate search errors', async () => {
      const userId = '1';
      const communityId = 5;
      const keyword = 'test';

      (service.searchPosts as jest.Mock).mockRejectedValueOnce(
        new Error('Search failed'),
      );

      await expect(
        controller.search(userId, communityId, keyword),
      ).rejects.toThrow('Search failed');
    });

    it('should propagate getPosts errors', async () => {
      const userId = '1';
      const communityId = 5;

      (service.getPosts as jest.Mock).mockRejectedValueOnce(
        new Error('Fetch failed'),
      );

      await expect(
        controller.getPosts(userId, communityId, 20, 0, 'newest'),
      ).rejects.toThrow('Fetch failed');
    });

    it('should propagate delete errors', async () => {
      const userId = '1';
      const postId = '100';

      (service.deletePost as jest.Mock).mockRejectedValueOnce(
        new Error('Delete failed'),
      );

      await expect(controller.deletePost(userId, postId)).rejects.toThrow(
        'Delete failed',
      );
    });
  });

  describe('Header validation', () => {
    it('should handle userId header correctly', async () => {
      const userId = '1';
      const communityId = 5;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(1);
    });

    it('should handle different userId formats', async () => {
      const userIds = ['1', '100', '9999'];

      for (let i = 0; i < userIds.length; i++) {
        const userId = userIds[i];
        (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

        await controller.getPosts(userId, 5, 20, 0, 'newest');

        const callArgs = (service.getPosts as jest.Mock).mock.calls[i];
        expect(callArgs[0]).toBe(Number(userId));
      }
    });
  });

  describe('Query parameters handling', () => {
    it('should handle undefined query parameters', async () => {
      const userId = '1';
      const communityId = 5;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, 20, 0, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe(20); // default limit
      expect(callArgs[3]).toBe(0); // default offset
      expect(callArgs[4]).toBe('newest'); // default sort
    });

    it('should handle zero values in query parameters', async () => {
      const userId = '1';
      const communityId = 5;
      const limit = 0;
      const offset = 0;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, limit, offset, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      /* when limit is 0, it should use default 20 */
      expect(callArgs[2]).toBe(20);
    });

    it('should handle positive query parameters', async () => {
      const userId = '1';
      const communityId = 5;
      const limit = 30;
      const offset = 60;

      (service.getPosts as jest.Mock).mockResolvedValueOnce([]);

      await controller.getPosts(userId, communityId, limit, offset, 'newest');

      const callArgs = (service.getPosts as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe(30);
      expect(callArgs[3]).toBe(60);
    });
  });
});
