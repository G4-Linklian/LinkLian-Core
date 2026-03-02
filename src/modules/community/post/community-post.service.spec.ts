jest.mock('../../file-storage/file-storage.service');

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommunityPostService } from './community-post.service';
import { CommunityService } from '../core/community.service';
import { FileStorageService } from '../../file-storage/file-storage.service';

describe('CommunityPostService', () => {
  let service: CommunityPostService;
  let dataSource: DataSource;
  let communityService: CommunityService;
  let fileStorageService: FileStorageService;

  beforeEach(async () => {
    const mockDataSource = {
      createQueryRunner: jest.fn(),
      query: jest.fn(),
    };

    const mockCommunityService = {
      checkReadPermission: jest.fn(),
    };

    const mockFileStorageService = {
      uploadFiles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityPostService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: CommunityService, useValue: mockCommunityService },
        { provide: FileStorageService, useValue: mockFileStorageService },
      ],
    }).compile();

    service = module.get<CommunityPostService>(CommunityPostService);
    dataSource = module.get<DataSource>(DataSource);
    communityService = module.get<CommunityService>(CommunityService);
    fileStorageService = module.get<FileStorageService>(FileStorageService);
  });

  describe('createPost', () => {
    let queryRunner: any;

    beforeEach(() => {
      queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          query: jest.fn(),
        },
      };

      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(queryRunner);
    });

    it('should create post successfully', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Hello world' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      const result = await service.createPost(userId, dto);

      expect(result.success).toBe(true);
      expect(result.post_id).toBe(100);
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if content is empty', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: '   ' };

      await expect(service.createPost(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if content is missing', async () => {
      const userId = 1;
      const dto = { community_id: 5 };

      await expect(service.createPost(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if dto is null', async () => {
      const userId = 1;

      await expect(service.createPost(userId, null)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should trim content before saving', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: '  Hello world  ' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      await service.createPost(userId, dto);

      const insertCall = queryRunner.manager.query.mock.calls[0];
      expect(insertCall[1][2]).toBe('Hello world');
    });

    it('should create post with attachments', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post with images' };
      const files = [
        {
          originalname: 'image.jpg',
          mimetype: 'image/jpeg',
        } as Express.Multer.File,
      ];

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: 'http://example.com/image.jpg',
            fileType: 'image/jpeg',
            originalName: 'image.jpg',
          },
        ],
      });

      queryRunner.manager.query.mockResolvedValueOnce(undefined); // attachment insert

      await service.createPost(userId, dto, files);

      expect(fileStorageService.uploadFiles).toHaveBeenCalledWith(
        'community',
        'post',
        files,
      );
      expect(queryRunner.manager.query).toHaveBeenCalledTimes(2);
    });

    it('should handle image attachment correctly', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post with image' };
      const files = [
        {
          originalname: 'pic.png',
          mimetype: 'image/png',
        } as Express.Multer.File,
      ];

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: 'http://example.com/pic.png',
            fileType: 'image/png',
            originalName: 'pic.png',
          },
        ],
      });

      queryRunner.manager.query.mockResolvedValueOnce(undefined);

      await service.createPost(userId, dto, files);

      const attachmentCall = queryRunner.manager.query.mock.calls[1];
      expect(attachmentCall[1][2]).toBe('image');
    });

    it('should handle video attachment correctly', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post with video' };
      const files = [
        {
          originalname: 'video.mp4',
          mimetype: 'video/mp4',
        } as Express.Multer.File,
      ];

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: 'http://example.com/video.mp4',
            fileType: 'video/mp4',
            originalName: 'video.mp4',
          },
        ],
      });

      queryRunner.manager.query.mockResolvedValueOnce(undefined);

      await service.createPost(userId, dto, files);

      const attachmentCall = queryRunner.manager.query.mock.calls[1];
      expect(attachmentCall[1][2]).toBe('video');
    });

    it('should handle pdf attachment correctly', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post with pdf' };
      const files = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
        } as Express.Multer.File,
      ];

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: 'http://example.com/document.pdf',
            fileType: 'application/pdf',
            originalName: 'document.pdf',
          },
        ],
      });

      queryRunner.manager.query.mockResolvedValueOnce(undefined);

      await service.createPost(userId, dto, files);

      const attachmentCall = queryRunner.manager.query.mock.calls[1];
      expect(attachmentCall[1][2]).toBe('pdf');
    });

    it('should handle multiple attachments', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post with multiple files' };
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

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: 'http://example.com/img1.jpg',
            fileType: 'image/jpeg',
            originalName: 'img1.jpg',
          },
          {
            fileUrl: 'http://example.com/img2.png',
            fileType: 'image/png',
            originalName: 'img2.png',
          },
        ],
      });

      queryRunner.manager.query.mockResolvedValueOnce(undefined); // img1
      queryRunner.manager.query.mockResolvedValueOnce(undefined); // img2

      await service.createPost(userId, dto, files);

      expect(queryRunner.manager.query).toHaveBeenCalledTimes(3);
    });

    it('should rollback transaction on error', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post content' };

      queryRunner.manager.query.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(service.createPost(userId, dto)).rejects.toThrow(
        'Database error',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should release queryRunner after success', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post content' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      await service.createPost(userId, dto);

      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should release queryRunner on error', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post content' };

      queryRunner.manager.query.mockRejectedValueOnce(
        new Error('Database error'),
      );

      try {
        await service.createPost(userId, dto);
      } catch {
        // expected
      }

      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should use userId in post creation', async () => {
      const userId = 42;
      const dto = { community_id: 5, content: 'My post' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      await service.createPost(userId, dto);

      const insertCall = queryRunner.manager.query.mock.calls[0];
      expect(insertCall[1][1]).toBe(42);
    });

    it('should use communityId from dto', async () => {
      const userId = 1;
      const dto = { community_id: 99, content: 'Community post' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      await service.createPost(userId, dto);

      const insertCall = queryRunner.manager.query.mock.calls[0];
      expect(insertCall[1][0]).toBe(99);
    });
  });

  describe('getPosts', () => {
    it('should get posts successfully', async () => {
      const userId = 1;
      const communityId = 5;

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const mockPosts = [
        {
          post_commu_id: 100,
          content: 'First post',
          created_at: new Date(),
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic.jpg',
          attachments: [],
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockPosts);

      const result = await service.getPosts(userId, communityId);

      expect(communityService.checkReadPermission).toHaveBeenCalledWith(
        userId,
        communityId,
      );
      expect(result).toEqual(mockPosts);
    });

    it('should check permission before getting posts', async () => {
      const userId = 1;
      const communityId = 5;

      (communityService.checkReadPermission as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('No access'),
      );

      await expect(service.getPosts(userId, communityId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should use default pagination (limit 20, offset 0)', async () => {
      const userId = 1;
      const communityId = 5;

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.getPosts(userId, communityId);

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      expect(queryCall[1][1]).toBe(20);
      expect(queryCall[1][2]).toBe(0);
    });

    it('should use custom pagination values', async () => {
      const userId = 1;
      const communityId = 5;

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.getPosts(userId, communityId, 50, 100);

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      expect(queryCall[1][1]).toBe(50);
      expect(queryCall[1][2]).toBe(100);
    });

    it('should sort by newest by default', async () => {
      const userId = 1;
      const communityId = 5;

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.getPosts(userId, communityId);

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      const query = queryCall[0];
      expect(query).toContain('DESC');
    });

    it('should sort by oldest when specified', async () => {
      const userId = 1;
      const communityId = 5;

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.getPosts(userId, communityId, 20, 0, 'oldest');

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      const query = queryCall[0];
      expect(query).toContain('ASC');
    });

    it('should include attachments in results', async () => {
      const userId = 1;
      const communityId = 5;

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const mockPosts = [
        {
          post_commu_id: 100,
          content: 'Post with attachments',
          attachments: [
            { url: 'img1.jpg', type: 'image' },
            { url: 'img2.jpg', type: 'image' },
          ],
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockPosts);

      const result = await service.getPosts(userId, communityId);

      expect(result[0].attachments).toHaveLength(2);
    });

    it('should return empty array if no posts', async () => {
      const userId = 1;
      const communityId = 999;

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getPosts(userId, communityId);

      expect(result).toEqual([]);
    });

    it('should include user info in posts', async () => {
      const userId = 1;
      const communityId = 5;

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const mockPosts = [
        {
          post_commu_id: 100,
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic.jpg',
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockPosts);

      const result = await service.getPosts(userId, communityId);

      expect(result[0]).toHaveProperty('first_name', 'John');
      expect(result[0]).toHaveProperty('profile_pic');
    });
  });

  describe('deletePost', () => {
    let queryRunner: any;

    beforeEach(() => {
      queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          query: jest.fn(),
        },
      };

      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(queryRunner);
    });

    it('should delete post successfully', async () => {
      const userId = 1;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1 },
      ]);

      queryRunner.manager.query.mockResolvedValueOnce(undefined); // delete post
      queryRunner.manager.query.mockResolvedValueOnce(undefined); // delete attachments

      const result = await service.deletePost(userId, postId);

      expect(result.success).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if post not found', async () => {
      const userId = 1;
      const postId = 999;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(service.deletePost(userId, postId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if user is not post author', async () => {
      const userId = 1;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 99 },
      ]);

      await expect(service.deletePost(userId, postId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should soft delete the post (flag_valid=false)', async () => {
      const userId = 1;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1 },
      ]);

      queryRunner.manager.query.mockResolvedValueOnce(undefined); // delete post
      queryRunner.manager.query.mockResolvedValueOnce(undefined); // delete attachments

      await service.deletePost(userId, postId);

      const deleteCall = queryRunner.manager.query.mock.calls[0];
      expect(deleteCall[0]).toContain('flag_valid=false');
      expect(deleteCall[1][0]).toBe(100);
    });

    it('should soft delete attachments', async () => {
      const userId = 1;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1 },
      ]);

      queryRunner.manager.query.mockResolvedValueOnce(undefined); // delete post
      queryRunner.manager.query.mockResolvedValueOnce(undefined); // delete attachments

      await service.deletePost(userId, postId);

      const attachmentDeleteCall = queryRunner.manager.query.mock.calls[1];
      expect(attachmentDeleteCall[0]).toContain('community_attachment');
      expect(attachmentDeleteCall[0]).toContain('flag_valid=false');
    });

    it('should rollback if deletion fails', async () => {
      const userId = 1;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1 },
      ]);

      queryRunner.manager.query.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(service.deletePost(userId, postId)).rejects.toThrow(
        'Database error',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should release queryRunner after deletion', async () => {
      const userId = 1;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1 },
      ]);

      queryRunner.manager.query.mockResolvedValueOnce(undefined);
      queryRunner.manager.query.mockResolvedValueOnce(undefined);

      await service.deletePost(userId, postId);

      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should check post ownership before deletion', async () => {
      const userId = 99;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1 },
      ]);

      await expect(service.deletePost(userId, postId)).rejects.toThrow(
        'Not allowed',
      );

      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });
  });

  describe('searchPosts', () => {
    it('should search posts successfully', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'hello';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const mockResults = [
        {
          post_commu_id: 100,
          content: 'Hello world',
          created_at: new Date(),
          first_name: 'John',
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await service.searchPosts(userId, communityId, keyword);

      expect(result).toEqual(mockResults);
    });

    it('should check permission before searching', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'test';

      (communityService.checkReadPermission as jest.Mock).mockRejectedValueOnce(
        new ForbiddenException('No access'),
      );

      await expect(
        service.searchPosts(userId, communityId, keyword),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should use default limit of 50', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'search';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.searchPosts(userId, communityId, keyword);

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      expect(queryCall[1][2]).toBe(50);
    });

    it('should use custom limit', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'search';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.searchPosts(userId, communityId, keyword, 100);

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      expect(queryCall[1][2]).toBe(100);
    });

    it('should search using ILIKE for case-insensitive search', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'Hello';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.searchPosts(userId, communityId, keyword);

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      const query = queryCall[0];
      expect(query).toContain('ILIKE');
    });

    it('should pass keyword to query', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'javascript';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.searchPosts(userId, communityId, keyword);

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      expect(queryCall[1][1]).toBe('javascript');
    });

    it('should sort results by newest', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'test';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.searchPosts(userId, communityId, keyword);

      const queryCall = (dataSource.query as jest.Mock).mock.calls[0];
      const query = queryCall[0];
      expect(query).toContain('ORDER BY cp.created_at DESC');
    });

    it('should return empty array if no results', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'nonexistent';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.searchPosts(userId, communityId, keyword);

      expect(result).toEqual([]);
    });

    it('should include user info in search results', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'search';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const mockResults = [
        {
          post_commu_id: 100,
          content: 'Search result',
          first_name: 'Jane',
          last_name: 'Smith',
          profile_pic: 'jane.jpg',
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await service.searchPosts(userId, communityId, keyword);

      expect(result[0]).toHaveProperty('first_name', 'Jane');
      expect(result[0]).toHaveProperty('profile_pic');
    });

    it('should include attachments in search results', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'image';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const mockResults = [
        {
          post_commu_id: 100,
          content: 'Post with image',
          attachments: [{ url: 'image.jpg', type: 'image' }],
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await service.searchPosts(userId, communityId, keyword);

      expect(result[0]).toHaveProperty('attachments');
    });

    it('should search multiple keywords (partial match)', async () => {
      const userId = 1;
      const communityId = 5;
      const keyword = 'javascript';

      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const mockResults = [
        { post_commu_id: 100, content: 'I love JavaScript' },
        { post_commu_id: 101, content: 'JavaScript tutorial' },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await service.searchPosts(userId, communityId, keyword);

      expect(result).toHaveLength(2);
    });
  });

  describe('Transaction handling', () => {
    let queryRunner: any;

    beforeEach(() => {
      queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          query: jest.fn(),
        },
      };

      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(queryRunner);
    });

    it('should create queryRunner for createPost', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      await service.createPost(userId, dto);

      expect(dataSource.createQueryRunner).toHaveBeenCalled();
    });

    it('should connect queryRunner for createPost', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      await service.createPost(userId, dto);

      expect(queryRunner.connect).toHaveBeenCalled();
    });

    it('should start transaction for createPost', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      await service.createPost(userId, dto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
    });

    it('should create queryRunner for deletePost', async () => {
      const userId = 1;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1 },
      ]);

      queryRunner.manager.query.mockResolvedValueOnce(undefined);
      queryRunner.manager.query.mockResolvedValueOnce(undefined);

      await service.deletePost(userId, postId);

      expect(dataSource.createQueryRunner).toHaveBeenCalled();
    });

    it('should commit transaction on success', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post' };

      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      await service.createPost(userId, dto);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should rollback on error during createPost', async () => {
      const userId = 1;
      const dto = { community_id: 5, content: 'Post' };

      queryRunner.manager.query.mockRejectedValueOnce(new Error('Error'));

      try {
        await service.createPost(userId, dto);
      } catch {
        // expected
      }

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should rollback on error during deletePost', async () => {
      const userId = 1;
      const postId = 100;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1 },
      ]);

      queryRunner.manager.query.mockRejectedValueOnce(new Error('Error'));

      try {
        await service.deletePost(userId, postId);
      } catch {
        // expected
      }

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    let queryRunner: any;

    beforeEach(() => {
      queryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          query: jest.fn(),
        },
      };

      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(queryRunner);
    });

    it('should create post then search for it', async () => {
      const userId = 1;
      const communityId = 5;

      // Create post
      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      const createDto = { community_id: communityId, content: 'Hello world' };
      const createResult = await service.createPost(userId, createDto);
      expect(createResult.success).toBe(true);

      // Search for post
      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        {
          post_commu_id: 100,
          content: 'Hello world',
        },
      ]);

      const searchResult = await service.searchPosts(
        userId,
        communityId,
        'Hello',
      );
      expect(searchResult).toHaveLength(1);
    });

    it('should create post with attachments then delete it', async () => {
      const userId = 1;
      const communityId = 5;
      const files = [
        {
          originalname: 'image.jpg',
          mimetype: 'image/jpeg',
        } as Express.Multer.File,
      ];

      // Create post with attachment
      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: 'http://example.com/image.jpg',
            fileType: 'image/jpeg',
            originalName: 'image.jpg',
          },
        ],
      });

      queryRunner.manager.query.mockResolvedValueOnce(undefined);

      const createDto = {
        community_id: communityId,
        content: 'Post with image',
      };
      await service.createPost(userId, createDto, files);

      // Delete post
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: userId },
      ]);

      queryRunner.manager.query.mockResolvedValueOnce(undefined); // delete post
      queryRunner.manager.query.mockResolvedValueOnce(undefined); // delete attachments

      const deleteResult = await service.deletePost(userId, 100);
      expect(deleteResult.success).toBe(true);
    });

    it('should get posts then search within results', async () => {
      const userId = 1;
      const communityId = 5;

      // Get posts
      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      const mockPosts = [
        { post_commu_id: 100, content: 'JavaScript tips' },
        { post_commu_id: 101, content: 'Python tutorial' },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockPosts);

      const posts = await service.getPosts(userId, communityId);
      expect(posts).toHaveLength(2);

      // Search posts
      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 100, content: 'JavaScript tips' },
      ]);

      const searchResult = await service.searchPosts(
        userId,
        communityId,
        'JavaScript',
      );
      expect(searchResult).toHaveLength(1);
    });

    it('should handle multiple post operations in sequence', async () => {
      const userId = 1;
      const communityId = 5;

      // Create first post
      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 100 }]);

      const dto1 = { community_id: communityId, content: 'First post' };
      const result1 = await service.createPost(userId, dto1);
      expect(result1.post_id).toBe(100);

      // Create second post
      queryRunner.manager.query.mockResolvedValueOnce([{ post_commu_id: 101 }]);

      const dto2 = { community_id: communityId, content: 'Second post' };
      const result2 = await service.createPost(userId, dto2);
      expect(result2.post_id).toBe(101);

      // Get both posts
      (communityService.checkReadPermission as jest.Mock).mockResolvedValueOnce(
        undefined,
      );

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 101, content: 'Second post' },
        { post_commu_id: 100, content: 'First post' },
      ]);

      const posts = await service.getPosts(userId, communityId);
      expect(posts).toHaveLength(2);
    });
  });
});
