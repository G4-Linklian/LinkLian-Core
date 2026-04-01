import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunityCommentService } from './community-comment.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

describe('CommunityCommentService', () => {
  let service: CommunityCommentService;
  let dataSource: any;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    };

    const mockDataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const mockLogger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityCommentService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CommunityCommentService>(CommunityCommentService);
    dataSource = mockDataSource;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getComments', () => {
    it('should get root comments with pagination', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([
          {
            comment_id: 1,
            post_commu_id: 1,
            user_sys_id: 1,
            comment_text: 'Comment 1',
            created_at: '2026-02-14',
            parent_id: null,
            children_count: 0,
            display_name: 'John',
            profile_pic: 'pic.jpg',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getComments({
        post_commu_id: 1,
        limit: 10,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(1);
    });

    it('should throw error when post_commu_id missing', async () => {
      await expect(service.getComments({} as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createComment', () => {
    it('should create comment', async () => {
      dataSource.query.mockResolvedValueOnce([{}]); // mock user for ensureActiveUser
      dataSource.query.mockResolvedValueOnce([
        { status: 'active', is_private: false },
      ]);

      mockQueryRunner.query
        .mockResolvedValueOnce([{ commu_comment_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.createComment(1, {
        post_commu_id: 1,
        comment_text: 'New',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateComment', () => {
    it('should throw ForbiddenException if community is inactive', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'inactive' }])
        .mockResolvedValueOnce([
          { commu_comment_id: 1, user_sys_id: 1 },
        ])
        .mockResolvedValueOnce([]);

      await expect(service.updateComment(1, {
        comment_id: 1,
        comment_text: 'Updated',
      })).rejects.toThrow('Community is inactive');
    });
  });

  describe('deleteComment', () => {
  it('should delete comment by owner', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ status: 'active' }])
      .mockResolvedValueOnce([{ commu_comment_id: 1 }]);

    mockQueryRunner.query
      .mockResolvedValueOnce([{ user_sys_id: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.deleteComment(1, 1);

    expect(result.success).toBe(true);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('should throw error when not owner', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ status: 'active' }])
      .mockResolvedValueOnce([{ commu_comment_id: 1 }]);

    mockQueryRunner.query
      .mockResolvedValueOnce([{ user_sys_id: 999 }]);

    await expect(service.deleteComment(1, 1)).rejects.toThrow(
      ForbiddenException,
    );

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
});