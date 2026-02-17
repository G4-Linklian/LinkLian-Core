import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunityCommentService } from './community-comment.service';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityCommentService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CommunityCommentService>(CommunityCommentService);
    dataSource = mockDataSource;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getComments', () => {
    const postId = 1;

    it('should get root comments with pagination', async () => {
      const dto = {
        post_commu_id: postId,
        limit: 10,
        offset: 0,
      };

      const mockComments = [
        {
          comment_id: 1,
          post_commu_id: postId,
          user_sys_id: 1,
          comment_text: 'Comment 1',
          created_at: '2026-02-14',
          updated_at: '2026-02-14',
          flag_valid: true,
          parent_id: null,
          children_count: 0,
          display_name: 'John Doe',
          profile_pic: 'pic.jpg',
        },
      ];

      dataSource.query
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce(mockComments)
        .mockResolvedValueOnce([]);

      const result = await service.getComments(dto);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should throw error when post_commu_id missing', async () => {
      const dto = {
        limit: 10,
        offset: 0,
      };

      await expect(service.getComments(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should use default limit and offset', async () => {
      const dto = {
        post_commu_id: postId,
      };

      dataSource.query
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([]);

      await service.getComments(dto);

      expect(dataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        [postId, 10, 0],
      );
    });

    it('should handle pagination correctly', async () => {
      const dto = {
        post_commu_id: postId,
        limit: 5,
        offset: 10,
      };

      dataSource.query
        .mockResolvedValueOnce([{ total: '20' }])
        .mockResolvedValueOnce([]);

      const result = await service.getComments(dto);

      expect(result.hasMore).toBe(true);
    });

    it('should count total correctly', async () => {
      const dto = {
        post_commu_id: postId,
        limit: 10,
        offset: 0,
      };

      dataSource.query
        .mockResolvedValueOnce([{ total: '100' }])
        .mockResolvedValueOnce([]);

      const result = await service.getComments(dto);

      expect(result.total).toBe(100);
    });

    it('should include children in response', async () => {
      const dto = {
        post_commu_id: postId,
        limit: 10,
        offset: 0,
      };

      const mockComments = [
        {
          comment_id: 1,
          post_commu_id: postId,
          user_sys_id: 1,
          comment_text: 'Root comment',
          created_at: '2026-02-14',
          children_count: 0,
          display_name: 'John Doe',
          profile_pic: 'pic.jpg',
        },
      ];

      dataSource.query
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce(mockComments)
        .mockResolvedValueOnce([]);

      const result = await service.getComments(dto);

      expect(result.data[0]).toHaveProperty('children');
    });

    it('should handle string total from query', async () => {
      const dto = {
        post_commu_id: postId,
      };

      dataSource.query
        .mockResolvedValueOnce([{ total: '5' }])
        .mockResolvedValueOnce([]);

      const result = await service.getComments(dto);

      expect(result.total).toBe(5);
      expect(typeof result.total).toBe('number');
    });

    it('should handle null total result', async () => {
      const dto = {
        post_commu_id: postId,
      };

      dataSource.query
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([]);

      const result = await service.getComments(dto);

      expect(result.total).toBe(0);
    });

    it('should filter by flag_valid=true', async () => {
      const dto = {
        post_commu_id: postId,
      };

      dataSource.query
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([]);

      await service.getComments(dto);

      const countQuery = dataSource.query.mock.calls[0][0];
      expect(countQuery).toContain('flag_valid=true');

      const selectQuery = dataSource.query.mock.calls[1][0];
      expect(selectQuery).toContain('flag_valid=true');
    });
  });

  describe('createComment', () => {
    const userId = 1;
    const postId = 1;

    it('should create comment without parent', async () => {
      const dto = {
        post_commu_id: postId,
        comment_text: 'New comment',
        parent_id: null,
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ commu_comment_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.createComment(userId, dto);

      expect(result.success).toBe(true);
      expect(result.data.comment_id).toBe(1);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should create comment with parent', async () => {
      const dto = {
        post_commu_id: postId,
        comment_text: 'Reply comment',
        parent_id: 5,
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ commu_comment_id: 2 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.createComment(userId, dto);

      expect(result.success).toBe(true);
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
    });

    it('should throw error when post_commu_id missing', async () => {
      const dto = {
        comment_text: 'Comment',
      };

      await expect(service.createComment(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when comment_text missing', async () => {
      const dto = {
        post_commu_id: postId,
      };

      await expect(service.createComment(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should rollback on error', async () => {
      const dto = {
        post_commu_id: postId,
        comment_text: 'Comment',
      };

      mockQueryRunner.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.createComment(userId, dto)).rejects.toThrow(
        'DB error',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should insert comment with created_at and updated_at', async () => {
      const dto = {
        post_commu_id: postId,
        comment_text: 'Test',
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ commu_comment_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.createComment(userId, dto);

      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('INSERT INTO community_comment'),
        [postId, userId, 'Test'],
      );
    });

    it('should create comment_path entry', async () => {
      const dto = {
        post_commu_id: postId,
        comment_text: 'Comment',
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ commu_comment_id: 10 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.createComment(userId, dto);

      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO community_comment_path'),
        [10],
      );
    });

    it('should create path for parent comment', async () => {
      const parentId = 5;
      const dto = {
        post_commu_id: postId,
        comment_text: 'Reply',
        parent_id: parentId,
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ commu_comment_id: 11 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.createComment(userId, dto);

      expect(mockQueryRunner.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO community_comment_path'),
        [11, parentId],
      );
    });
  });

  describe('updateComment', () => {
    const userId = 1;
    const commentId = 1;

    it('should update comment by owner', async () => {
      const dto = {
        comment_id: commentId,
        comment_text: 'Updated text',
      };

      dataSource.query.mockResolvedValueOnce([
        { commu_comment_id: commentId, user_sys_id: userId },
      ]);

      const result = await service.updateComment(userId, dto);

      expect(result.success).toBe(true);
    });

    it('should throw error when comment not found', async () => {
      const dto = {
        comment_id: 999,
        comment_text: 'Text',
      };

      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.updateComment(userId, dto)).rejects.toThrow(
        'Not allowed',
      );
    });

    it('should throw error when not comment owner', async () => {
      const dto = {
        comment_id: commentId,
        comment_text: 'Text',
      };

      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.updateComment(userId, dto)).rejects.toThrow(
        'Not allowed',
      );
    });

    it('should update with new text and timestamp', async () => {
      const dto = {
        comment_id: commentId,
        comment_text: 'New comment text',
      };

      dataSource.query.mockResolvedValueOnce([
        { commu_comment_id: commentId },
      ]);

      await service.updateComment(userId, dto);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE community_comment'),
        ['New comment text', commentId, userId],
      );
    });

    it('should only update own comments', async () => {
      const dto = {
        comment_id: commentId,
        comment_text: 'Text',
      };

      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.updateComment(userId, dto)).rejects.toThrow();

      const query = dataSource.query.mock.calls[0][0];
      expect(query).toContain('user_sys_id=$3');
    });
  });

  describe('deleteComment', () => {
    const userId = 1;
    const commentId = 1;

    it('should delete comment by owner', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ user_sys_id: userId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.deleteComment(userId, commentId);

      expect(result.success).toBe(true);
    });

    it('should throw error when comment not found', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.deleteComment(userId, commentId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw error when not comment owner', async () => {
      dataSource.query.mockResolvedValueOnce([
        { user_sys_id: 999 },
      ]);

      await expect(service.deleteComment(userId, commentId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete comment and all children', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ user_sys_id: userId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.deleteComment(userId, commentId);

      expect(dataSource.query).toHaveBeenCalledTimes(3);
      expect(dataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('UPDATE community_comment'),
        [commentId],
      );
    });

    it('should mark comment as invalid', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ user_sys_id: userId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.deleteComment(userId, commentId);

      const deleteQuery = dataSource.query.mock.calls[1][0];
      expect(deleteQuery).toContain('flag_valid=false');
    });

    it('should update comment_path to invalid', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ user_sys_id: userId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.deleteComment(userId, commentId);

      const pathQuery = dataSource.query.mock.calls[2][0];
      expect(pathQuery).toContain('community_comment_path');
      expect(pathQuery).toContain('flag_valid=false');
    });

    it('should only delete own comments', async () => {
      dataSource.query.mockResolvedValueOnce([{ user_sys_id: 999 }]);

      await expect(service.deleteComment(userId, commentId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should handle descendant deletion', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ user_sys_id: userId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.deleteComment(userId, commentId);

      expect(dataSource.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration scenarios', () => {
    const userId = 1;
    const postId = 1;

    it('should create comment successfully', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ commu_comment_id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const createDto = {
        post_commu_id: postId,
        comment_text: 'Root comment',
      };

      const createResult = await service.createComment(userId, createDto);
      expect(createResult.success).toBe(true);
      expect(createResult.data.comment_id).toBe(1);
    });

    it('should update comment successfully', async () => {
      dataSource.query.mockResolvedValueOnce([
        { commu_comment_id: 1, user_sys_id: userId },
      ]);

      const updateDto = {
        comment_id: 1,
        comment_text: 'Updated text',
      };

      const updateResult = await service.updateComment(userId, updateDto);
      expect(updateResult.success).toBe(true);
    });

    it('should delete comment successfully', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ user_sys_id: userId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const deleteResult = await service.deleteComment(userId, 1);
      expect(deleteResult.success).toBe(true);
    });
  });
});
