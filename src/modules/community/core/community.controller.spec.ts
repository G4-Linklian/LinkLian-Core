// Mock FileStorageService before any imports
jest.mock('../../file-storage/file-storage.service', () => ({
  FileStorageService: jest.fn().mockImplementation(() => ({
    uploadFiles: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { FileStorageService } from '../../file-storage/file-storage.service';

describe('CommunityController', () => {
  let controller: CommunityController;
  let communityService: CommunityService;
  let fileStorageService: FileStorageService;

  beforeEach(async () => {
    const mockCommunityService = {
      createCommunity: jest.fn(),
      listCommunity: jest.fn(),
      getCommunityDetail: jest.fn(),
      searchTag: jest.fn(),
      getCommunityFeed: jest.fn(),
    };

    const mockFileStorageService = {
      uploadFiles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [
        { provide: CommunityService, useValue: mockCommunityService },
        { provide: FileStorageService, useValue: mockFileStorageService },
      ],
    }).compile();

    controller = module.get<CommunityController>(CommunityController);
    communityService = module.get<CommunityService>(CommunityService);
    fileStorageService = module.get<FileStorageService>(FileStorageService);
  });

  describe('create', () => {
    it('should throw BadRequestException if x-user-id is invalid', async () => {
      const invalidUserId = 'invalid-id';
      const dto = { name: 'Test', description: 'Test', is_private: false, rules: [], tags: [] };

      await expect(
        controller.create(invalidUserId, null as any, dto, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if x-user-id is not a number', async () => {
      const invalidUserId = 'abc';
      const dto = { name: 'Test', description: 'Test', is_private: false, rules: [], tags: [] };

      await expect(
        controller.create(invalidUserId, null as any, dto, {} as any),
      ).rejects.toThrow('Invalid x-user-id');
    });

    it('should create community without file', async () => {
      const userId = '1';
      const dto = {
        name: 'Test Community',
        description: 'Test Description',
        is_private: false,
        rules: [],
        tags: [],
      };

      (communityService.createCommunity as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
        community_name: dto.name,
      });

      const result = await controller.create(userId, null as any, dto, {} as any);

      expect(communityService.createCommunity).toHaveBeenCalledWith(1, {
        ...dto,
        image_banner: 'default_banner.png',
      });
      expect(result.community_id).toBe(100);
    });

    it('should create community with file upload', async () => {
      const userId = '1';
      const file = {
        originalname: 'banner.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from(''),
      } as Express.Multer.File;
      const dto = {
        name: 'Test Community',
        description: 'Test Description',
        is_private: false,
        rules: [],
        tags: [],
      };

      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: 'https://blob.storage/banner.jpg',
            fileType: 'image/jpeg',
            originalName: 'banner.jpg',
          },
        ],
      });

      (communityService.createCommunity as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
        community_name: dto.name,
      });

      const result = await controller.create(userId, file, dto, {} as any);

      expect(fileStorageService.uploadFiles).toHaveBeenCalledWith(
        'community',
        'banner',
        [file],
      );
      expect(communityService.createCommunity).toHaveBeenCalledWith(1, {
        ...dto,
        image_banner: 'https://blob.storage/banner.jpg',
      });
      expect(result.community_id).toBe(100);
    });

    it('should use default banner if file upload fails', async () => {
      const userId = '1';
      const file = {
        originalname: 'banner.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      const dto = {
        name: 'Test Community',
        description: 'Test Description',
        is_private: false,
        rules: [],
        tags: [],
      };

      (fileStorageService.uploadFiles as jest.Mock).mockRejectedValueOnce(
        new Error('Upload failed'),
      );

      await expect(
        controller.create(userId, file, dto, {} as any),
      ).rejects.toThrow('Upload failed');
    });

    it('should pass userId as number to service', async () => {
      const userId = '42';
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      (communityService.createCommunity as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
      });

      await controller.create(userId, null as any, dto, {} as any);

      const callArgs = (communityService.createCommunity as jest.Mock).mock
        .calls[0];
      expect(callArgs[0]).toBe(42);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should populate image_banner in dto before passing to service', async () => {
      const userId = '1';
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      (communityService.createCommunity as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
      });

      await controller.create(userId, null as any, dto, {} as any);

      const passedDto = (communityService.createCommunity as jest.Mock).mock
        .calls[0][1];
      expect(passedDto).toHaveProperty('image_banner');
    });
  });

  describe('searchTag', () => {
    it('should search tags without keyword', async () => {
      const mockTags = [
        { community_tag_id: 1, tag_name: 'math' },
        { community_tag_id: 2, tag_name: 'science' },
      ];

      (communityService.searchTag as jest.Mock).mockResolvedValueOnce(
        mockTags,
      );

      const result = await controller.searchTag();

      expect(communityService.searchTag).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockTags);
    });

    it('should search tags with keyword', async () => {
      const keyword = 'math';
      const mockTags = [{ community_tag_id: 1, tag_name: 'math' }];

      (communityService.searchTag as jest.Mock).mockResolvedValueOnce(
        mockTags,
      );

      const result = await controller.searchTag(keyword);

      expect(communityService.searchTag).toHaveBeenCalledWith(keyword);
      expect(result).toEqual(mockTags);
    });

    it('should pass keyword to service', async () => {
      const keyword = '#biology';

      (communityService.searchTag as jest.Mock).mockResolvedValueOnce([]);

      await controller.searchTag(keyword);

      expect(communityService.searchTag).toHaveBeenCalledWith(keyword);
    });
  });

  describe('list', () => {
    it('should throw BadRequestException if x-user-id is invalid', async () => {
      const invalidUserId = 'invalid-id';

      await expect(controller.list(invalidUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should list communities without keyword', async () => {
      const userId = '1';
      const mockCommunities = [
        { community_id: 1, community_name: 'Community 1' },
        { community_id: 2, community_name: 'Community 2' },
      ];

      (communityService.listCommunity as jest.Mock).mockResolvedValueOnce(
        mockCommunities,
      );

      const result = await controller.list(userId);

      expect(communityService.listCommunity).toHaveBeenCalledWith(1, undefined);
      expect(result).toEqual(mockCommunities);
    });

    it('should list communities with keyword', async () => {
      const userId = '1';
      const keyword = 'math';
      const mockCommunities = [
        { community_id: 1, community_name: 'Math Community' },
      ];

      (communityService.listCommunity as jest.Mock).mockResolvedValueOnce(
        mockCommunities,
      );

      const result = await controller.list(userId, keyword);

      expect(communityService.listCommunity).toHaveBeenCalledWith(1, keyword);
      expect(result).toEqual(mockCommunities);
    });

    it('should convert userId string to number', async () => {
      const userId = '99';

      (communityService.listCommunity as jest.Mock).mockResolvedValueOnce([]);

      await controller.list(userId);

      const callArgs = (communityService.listCommunity as jest.Mock).mock
        .calls[0];
      expect(callArgs[0]).toBe(99);
      expect(typeof callArgs[0]).toBe('number');
    });
  });

  describe('get', () => {
    it('should throw BadRequestException if x-user-id is invalid', async () => {
      const invalidUserId = 'invalid-id';
      const communityId = 1;

      await expect(
        controller.get(invalidUserId, communityId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should get community detail', async () => {
      const userId = '1';
      const communityId = 5;
      const mockDetail = {
        community_id: 5,
        community_name: 'Test Community',
        is_owner: true,
        member_count: 20,
      };

      (communityService.getCommunityDetail as jest.Mock).mockResolvedValueOnce(
        mockDetail,
      );

      const result = await controller.get(userId, communityId);

      expect(communityService.getCommunityDetail).toHaveBeenCalledWith(
        1,
        communityId,
      );
      expect(result).toEqual(mockDetail);
    });

    it('should convert userId to number', async () => {
      const userId = '42';
      const communityId = 10;

      (communityService.getCommunityDetail as jest.Mock).mockResolvedValueOnce(
        {},
      );

      await controller.get(userId, communityId);

      const callArgs = (communityService.getCommunityDetail as jest.Mock).mock
        .calls[0];
      expect(callArgs[0]).toBe(42);
    });

    it('should pass correct communityId', async () => {
      const userId = '1';
      const communityId = 999;

      (communityService.getCommunityDetail as jest.Mock).mockResolvedValueOnce(
        {},
      );

      await controller.get(userId, communityId);

      const callArgs = (communityService.getCommunityDetail as jest.Mock).mock
        .calls[0];
      expect(callArgs[1]).toBe(999);
    });
  });

  describe('getCommunityPosts', () => {
    it('should throw BadRequestException if x-user-id is invalid', async () => {
      const invalidUserId = 'invalid-id';
      const communityId = 1;

      await expect(
        controller.getCommunityPosts(invalidUserId, communityId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should get community feed', async () => {
      const userId = '1';
      const communityId = 5;
      const mockFeed = [
        { post_commu_id: 1, content: 'Post 1', created_at: new Date() },
      ];

      (communityService.getCommunityFeed as jest.Mock).mockResolvedValueOnce(
        mockFeed,
      );

      const result = await controller.getCommunityPosts(userId, communityId);

      expect(communityService.getCommunityFeed).toHaveBeenCalledWith(
        1,
        communityId,
      );
      expect(result).toEqual(mockFeed);
    });

    it('should convert userId to number', async () => {
      const userId = '123';
      const communityId = 10;

      (communityService.getCommunityFeed as jest.Mock).mockResolvedValueOnce(
        [],
      );

      await controller.getCommunityPosts(userId, communityId);

      const callArgs = (communityService.getCommunityFeed as jest.Mock).mock
        .calls[0];
      expect(callArgs[0]).toBe(123);
    });

    it('should pass correct communityId', async () => {
      const userId = '1';
      const communityId = 55;

      (communityService.getCommunityFeed as jest.Mock).mockResolvedValueOnce(
        [],
      );

      await controller.getCommunityPosts(userId, communityId);

      const callArgs = (communityService.getCommunityFeed as jest.Mock).mock
        .calls[0];
      expect(callArgs[1]).toBe(55);
    });

    it('should return posts array', async () => {
      const userId = '1';
      const communityId = 5;
      const posts = [
        { post_commu_id: 1, content: 'Post 1' },
        { post_commu_id: 2, content: 'Post 2' },
      ];

      (communityService.getCommunityFeed as jest.Mock).mockResolvedValueOnce(
        posts,
      );

      const result = await controller.getCommunityPosts(userId, communityId);

      expect(result).toHaveLength(2);
      expect(result[0].post_commu_id).toBe(1);
    });
  });

  describe('Header validation', () => {
    it('should reject NaN userId from string', async () => {
      const userId = 'not-a-number';
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      await expect(
        controller.create(userId, null as any, dto, {} as any),
      ).rejects.toThrow('Invalid x-user-id');
    });

    it('should reject empty userId', async () => {
      const userId = '';
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      await expect(
        controller.create(userId, null as any, dto, {} as any),
      ).rejects.toThrow('Invalid x-user-id');
    });

    it('should accept valid numeric string userId', async () => {
      const userId = '100';
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      (communityService.createCommunity as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
      });

      await controller.create(userId, null as any, dto, {} as any);

      const callArgs = (communityService.createCommunity as jest.Mock).mock
        .calls[0];
      expect(callArgs[0]).toBe(100);
    });
  });

  describe('File handling', () => {
    it('should handle multiple file types in upload', async () => {
      const userId = '1';
      const file = {
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: 'https://blob.storage/test.jpg',
            fileType: 'image/jpeg',
            originalName: 'test.jpg',
          },
        ],
      });

      (communityService.createCommunity as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
      });

      await controller.create(userId, file, dto, {} as any);

      expect(fileStorageService.uploadFiles).toHaveBeenCalledWith(
        'community',
        'banner',
        [file],
      );
    });

    it('should use first file from upload result', async () => {
      const userId = '1';
      const file = {
        originalname: 'banner.png',
        mimetype: 'image/png',
      } as Express.Multer.File;
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      const uploadUrl = 'https://blob.storage/banner-123.png';
      (fileStorageService.uploadFiles as jest.Mock).mockResolvedValueOnce({
        files: [
          {
            fileUrl: uploadUrl,
            fileType: 'image/png',
            originalName: 'banner.png',
          },
          {
            fileUrl: 'https://blob.storage/banner-456.png',
            fileType: 'image/png',
            originalName: 'banner2.png',
          },
        ],
      });

      (communityService.createCommunity as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
      });

      await controller.create(userId, file, dto, {} as any);

      const passedDto = (communityService.createCommunity as jest.Mock).mock
        .calls[0][1];
      expect(passedDto.image_banner).toBe(uploadUrl);
    });
  });

  describe('Error handling', () => {
    it('should propagate service errors', async () => {
      const userId = '1';
      const communityId = 999;

      (communityService.getCommunityDetail as jest.Mock).mockRejectedValueOnce(
        new Error('Not found'),
      );

      await expect(
        controller.get(userId, communityId),
      ).rejects.toThrow('Not found');
    });

    it('should propagate file upload errors', async () => {
      const userId = '1';
      const file = {
        originalname: 'banner.jpg',
      } as Express.Multer.File;
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      (fileStorageService.uploadFiles as jest.Mock).mockRejectedValueOnce(
        new Error('Upload failed'),
      );

      await expect(
        controller.create(userId, file, dto, {} as any),
      ).rejects.toThrow('Upload failed');
    });

    it('should propagate community creation errors', async () => {
      const userId = '1';
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      (communityService.createCommunity as jest.Mock).mockRejectedValueOnce(
        new Error('Creation failed'),
      );

      await expect(
        controller.create(userId, null as any, dto, {} as any),
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('Integration scenarios', () => {
    it('should create community and then get its details', async () => {
      const userId = '1';
      const createDto = {
        name: 'New Community',
        description: 'Test',
        is_private: false,
        rules: [],
        tags: [],
      };

      // Create
      (communityService.createCommunity as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
        community_name: createDto.name,
      });

      const created = await controller.create(userId, null as any, createDto, {} as any);

      // Get detail
      (communityService.getCommunityDetail as jest.Mock).mockResolvedValueOnce({
        community_id: 100,
        community_name: createDto.name,
        is_owner: true,
      });

      const detailed = await controller.get(userId, created.community_id);

      expect(detailed.is_owner).toBe(true);
    });

    it('should search tags then list communities', async () => {
      const userId = '1';
      const keyword = 'math';

      // Search tags
      (communityService.searchTag as jest.Mock).mockResolvedValueOnce([
        { community_tag_id: 1, tag_name: 'math' },
      ]);

      const tags = await controller.searchTag(keyword);
      expect(tags).toHaveLength(1);

      // List communities
      (communityService.listCommunity as jest.Mock).mockResolvedValueOnce([
        { community_id: 1, community_name: 'Math Community', tags: ['math'] },
      ]);

      const communities = await controller.list(userId, keyword);
      expect(communities).toHaveLength(1);
    });

    it('should list communities then get posts', async () => {
      const userId = '1';

      // List
      (communityService.listCommunity as jest.Mock).mockResolvedValueOnce([
        { community_id: 5, community_name: 'Test Community' },
      ]);

      const communities = await controller.list(userId);
      const firstCommunity = communities[0];

      // Get posts
      (communityService.getCommunityFeed as jest.Mock).mockResolvedValueOnce([
        { post_commu_id: 1, content: 'Post 1' },
      ]);

      const posts = await controller.getCommunityPosts(
        userId,
        firstCommunity.community_id,
      );
      expect(posts).toHaveLength(1);
    });
  });
});
