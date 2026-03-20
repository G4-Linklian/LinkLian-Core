jest.mock('../../file-storage/file-storage.service');

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CommunityPostService } from './community-post.service';
import { CommunityService } from '../core/community.service';
import { FileStorageService } from '../../file-storage/file-storage.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

describe('CommunityPostService', () => {
  let service: CommunityPostService;
  let dataSource: any;
  let communityService: any;
  let fileStorageService: any;
  let queryRunner: any;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    };

    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
      query: jest.fn(),
    };

    communityService = {
      checkReadPermission: jest.fn(),
    };

    fileStorageService = {
      uploadFiles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityPostService,
        { provide: DataSource, useValue: dataSource },
        { provide: CommunityService, useValue: communityService },
        { provide: FileStorageService, useValue: fileStorageService },
        { provide: AppLogger, useValue: { error: jest.fn() } },
      ],
    }).compile();

    service = module.get(CommunityPostService);
  });

  describe('createPost', () => {
    it('should create post successfully', async () => {
      queryRunner.query
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([{ post_commu_id: 100 }]);

      communityService.checkReadPermission.mockResolvedValue(undefined);

      dataSource.query.mockResolvedValue([
        { post_commu_id: 100, content: 'hello' },
      ]);

      const result = await service.createPost(1, {
        community_id: 1,
        content: 'hello',
      });

      expect(result.success).toBe(true);
      expect(result.data.post_commu_id).toBe(100);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw if content empty', async () => {
      await expect(
        service.createPost(1, { community_id: 1, content: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if community not found', async () => {
      queryRunner.query.mockResolvedValueOnce([]);

      await expect(
        service.createPost(1, { community_id: 1, content: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if community inactive', async () => {
      queryRunner.query.mockResolvedValueOnce([{ status: 'inactive' }]);

      await expect(
        service.createPost(1, { community_id: 1, content: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should rollback on error', async () => {
      queryRunner.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.createPost(1, { community_id: 1, content: 'x' }),
      ).rejects.toThrow('DB error');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getPosts', () => {
    it('should fetch posts', async () => {
      communityService.checkReadPermission.mockResolvedValue(undefined);
      dataSource.query.mockResolvedValue([{ post_commu_id: 1 }]);

      const result = await service.getPosts(1, 1);

      expect(result.data.posts).toHaveLength(1);
    });

    it('should throw if permission fails', async () => {
      communityService.checkReadPermission.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(service.getPosts(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deletePost', () => {
    it('should delete post if owner', async () => {
      queryRunner.query
        .mockResolvedValueOnce([{ user_sys_id: 1, community_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.deletePost(1, 100);

      expect(result.success).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw if post not found', async () => {
      queryRunner.query.mockResolvedValueOnce([]);

      await expect(service.deletePost(1, 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw forbidden if not owner', async () => {
      queryRunner.query
        .mockResolvedValueOnce([{ user_sys_id: 2, community_id: 1 }])
        .mockResolvedValueOnce([]);

      await expect(service.deletePost(1, 100)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updatePost', () => {
    it('should update content successfully', async () => {
      queryRunner.query
        .mockResolvedValueOnce([{ user_sys_id: 1, community_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      communityService.checkReadPermission.mockResolvedValue(undefined);

      dataSource.query.mockResolvedValue([
        { post_commu_id: 100, content: 'updated' },
      ]);

      const result = await service.updatePost(1, 100, {
        content: 'updated',
      });

      expect(result.success).toBe(true);
    });

    it('should throw if not owner', async () => {
      queryRunner.query.mockResolvedValueOnce([
        { user_sys_id: 2, community_id: 1 },
      ]);

      communityService.checkReadPermission.mockResolvedValue(undefined);

      await expect(
        service.updatePost(1, 100, { content: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('searchPosts', () => {
    it('should search successfully', async () => {
      communityService.checkReadPermission.mockResolvedValue(undefined);
      dataSource.query.mockResolvedValue([{ post_commu_id: 1 }]);

      const result = await service.searchPosts(1, 1, 'hello');

      expect(result.data.posts).toHaveLength(1);
    });

    it('should throw 500 if error', async () => {
      communityService.checkReadPermission.mockRejectedValue(
        new Error('fail'),
      );

      await expect(
        service.searchPosts(1, 1, 'x'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});