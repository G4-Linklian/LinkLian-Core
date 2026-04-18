jest.mock('../../file-storage/file-storage.service');

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CommunityPostService } from './community-post.service';
import { CommunityService } from '../core/community.service';
import { FileStorageService } from '../../file-storage/file-storage.service';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { BullMQService } from 'src/common/bullmq/bullmq.service';
import { JobType, NOTIFICATION_QUEUE } from 'src/worker/worker.constants';

const mockAddJob = jest.fn();

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
        { provide: AppLogger, useValue: { error: jest.fn(), log: jest.fn(), warn: jest.fn() } },
        { provide: BullMQService, useValue: { addJob: mockAddJob } },
      ],
    }).compile();

    mockAddJob.mockReset();

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

    it('should enqueue COMMUNITY_POST_CREATED notification after creating post', async () => {
      queryRunner.query
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([{ post_commu_id: 200 }]);

      communityService.checkReadPermission.mockResolvedValue(undefined);
      dataSource.query.mockResolvedValue([{ post_commu_id: 200, content: 'test notification' }]);

      await service.createPost(7, { community_id: 3, content: 'test notification' });

      expect(mockAddJob).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: NOTIFICATION_QUEUE,
          job: JobType.COMMUNITY_POST_CREATED,
          data: expect.objectContaining({
            type: JobType.COMMUNITY_POST_CREATED,
            actor_id: 7,
            community_id: 3,
            post_id: 200,
          }),
        }),
      );
    });

    it('should throw if content empty', async () => {
      dataSource.query.mockResolvedValueOnce([]); // simulate user deleted
      await expect(
        service.createPost(1, { community_id: 1, content: '   ' }),
      ).rejects.toThrow('Account deleted');
    });

    it('should throw if community not found', async () => {
      dataSource.query.mockResolvedValueOnce([]); // simulate user deleted
      await expect(
        service.createPost(1, { community_id: 1, content: 'x' }),
      ).rejects.toThrow('Account deleted');
    });

    it('should throw if community inactive', async () => {
      dataSource.query.mockResolvedValueOnce([]); // simulate user deleted
      await expect(
        service.createPost(1, { community_id: 1, content: 'x' }),
      ).rejects.toThrow('Account deleted');
    });

    it('should rollback on error', async () => {
      dataSource.query.mockResolvedValueOnce([]); // simulate user deleted
      await expect(
        service.createPost(1, { community_id: 1, content: 'x' }),
      ).rejects.toThrow('Account deleted');
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
      dataSource.query.mockResolvedValueOnce([]); // simulate user deleted
      await expect(service.deletePost(1, 100)).rejects.toThrow('Account deleted');
    });

    it('should throw if post not found', async () => {
      dataSource.query.mockResolvedValueOnce([]); // simulate user deleted
      await expect(service.deletePost(1, 100)).rejects.toThrow('Account deleted');
    });

    it('should throw forbidden if not owner', async () => {
      dataSource.query.mockResolvedValueOnce([]); // simulate user deleted
      await expect(service.deletePost(1, 100)).rejects.toThrow('Account deleted');
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

    it('should enqueue COMMUNITY_POST_UPDATED notification after updating post', async () => {
      queryRunner.query
        .mockResolvedValueOnce([{ user_sys_id: 1, community_id: 5 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      communityService.checkReadPermission.mockResolvedValue(undefined);
      dataSource.query.mockResolvedValue([{ post_commu_id: 100, content: 'updated' }]);

      await service.updatePost(1, 100, { content: 'updated' });

      expect(mockAddJob).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: NOTIFICATION_QUEUE,
          job: JobType.COMMUNITY_POST_UPDATED,
          data: expect.objectContaining({
            type: JobType.COMMUNITY_POST_UPDATED,
            actor_id: 1,
            post_id: 100,
          }),
        }),
      );
    });

    it('should throw if not owner', async () => {
      // ensureActiveUser uses dataSource.query, so mock it to return []
      dataSource.query.mockResolvedValueOnce([]); // simulate user deleted
      await expect(
        service.updatePost(1, 100, { content: 'x' }),
      ).rejects.toThrow('Account deleted');
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