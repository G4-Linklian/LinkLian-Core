import { Test, TestingModule } from '@nestjs/testing';
import { PostCommentService } from './post-comment.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostComment } from './entities/post-comment.entity';
import { PostCommentPath } from './entities/post-comment-path.entity';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

const mockQuery = jest.fn();
const mockQueryRunner = {
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  query: jest.fn(),
};
const mockDataSource = {
  query: mockQuery,
  createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
};
const mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
const mockRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };

const mockCommentRow = {
  comment_id: 1,
  post_id: 10,
  user_sys_id: 5,
  is_anonymous: false,
  comment_text: 'Hello',
  created_at: new Date(),
  updated_at: new Date(),
  flag_valid: true,
  parent_id: null,
  children_count: 0,
  display_name: 'John Doe',
  profile_pic: null,
};

describe('PostCommentService', () => {
  let service: PostCommentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostCommentService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
        { provide: getRepositoryToken(PostComment), useValue: mockRepo },
        { provide: getRepositoryToken(PostCommentPath), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PostCommentService>(PostCommentService);
    jest.clearAllMocks();
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
  });

  // ─── getPostComments ───────────────────────────────────────────────────────

  describe('getPostComments', () => {
    it('should throw BadRequestException if post_id is missing', async () => {
      await expect(
        service.getPostComments({ post_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return empty data when no comments', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '0' }])  // count
        .mockResolvedValueOnce([])                  // root comments
        .mockResolvedValueOnce([{ section_id: 1 }]); // section

      const result = await service.getPostComments({ post_id: 10 });
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should return comments with correct total and hasMore=false', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '1' }])       // count
        .mockResolvedValueOnce([mockCommentRow])         // root comments
        .mockResolvedValueOnce([{ section_id: 1 }])     // section
        .mockResolvedValueOnce([]);                      // children recursive

      const result = await service.getPostComments({ post_id: 10, limit: 10, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.data).toHaveLength(1);
    });

    it('should return hasMore=true when more pages exist', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '20' }])      // count
        .mockResolvedValueOnce([mockCommentRow])         // root comments
        .mockResolvedValueOnce([{ section_id: 1 }])     // section
        .mockResolvedValueOnce([]);                      // children recursive

      const result = await service.getPostComments({ post_id: 10, limit: 10, offset: 0 });
      expect(result.hasMore).toBe(true);
    });

    it('should expose display_name for non-anonymous comments', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([mockCommentRow])
        .mockResolvedValueOnce([{ section_id: 1 }])
        .mockResolvedValueOnce([]);

      const result = await service.getPostComments({ post_id: 10 });
      expect(result.data[0].display_name).toBe('John Doe');
    });

    it('should generate anonymous display_name for anonymous comments', async () => {
      const anonComment = { ...mockCommentRow, is_anonymous: true, display_name: null };
      mockQuery
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([anonComment])
        .mockResolvedValueOnce([{ section_id: 1 }])
        .mockResolvedValueOnce([]);

      const result = await service.getPostComments({ post_id: 10 });
      expect(result.data[0].display_name).toBeTruthy();
      expect(result.data[0].profile_pic).toBeNull();
    });

    it('should handle null section_id gracefully', async () => {
      mockQuery
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([mockCommentRow])
        .mockResolvedValueOnce([])   // no section found
        .mockResolvedValueOnce([]);  // children

      const result = await service.getPostComments({ post_id: 10 });
      expect(result.data).toHaveLength(1);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getPostComments({ post_id: 10 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createPostComment ─────────────────────────────────────────────────────

  describe('createPostComment', () => {
    it('should throw BadRequestException if post_id is missing', async () => {
      await expect(
        service.createPostComment(1, { post_id: 0, comment_text: 'Hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if comment_text is missing', async () => {
      await expect(
        service.createPostComment(1, { post_id: 10, comment_text: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a root comment successfully', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ comment_id: 1 }])  // insert comment
        .mockResolvedValueOnce([]);                    // insert self path

      const result = await service.createPostComment(1, {
        post_id: 10,
        comment_text: 'Hello',
        is_anonymous: false,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Comment created successfully');
      expect(result.data.comment_id).toBe(1);
    });

    it('should create a reply comment with parent_id', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ comment_id: 2 }])  // insert comment
        .mockResolvedValueOnce([])                    // insert self path
        .mockResolvedValueOnce([]);                   // insert reply paths

      const result = await service.createPostComment(1, {
        post_id: 10,
        comment_text: 'Reply',
        parent_id: 1,
      });

      expect(result.success).toBe(true);
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(3);
    });

    it('should create anonymous comment', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ comment_id: 3 }])
        .mockResolvedValueOnce([]);

      const result = await service.createPostComment(1, {
        post_id: 10,
        comment_text: 'Anonymous comment',
        is_anonymous: true,
      });

      expect(result.success).toBe(true);
      const [, insertParams] = mockQueryRunner.query.mock.calls[0];
      expect(insertParams[2]).toBe(true); // is_anonymous = true
    });

    it('should rollback and throw InternalServerErrorException on failure', async () => {
      mockQueryRunner.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.createPostComment(1, { post_id: 10, comment_text: 'Hi' }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ─── updatePostComment ─────────────────────────────────────────────────────

  describe('updatePostComment', () => {
    it('should throw BadRequestException if comment_id is missing', async () => {
      await expect(
        service.updatePostComment(1, { comment_id: 0, comment_text: 'Hi' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no fields to update', async () => {
      await expect(
        service.updatePostComment(1, { comment_id: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update comment_text successfully', async () => {
      mockQuery.mockResolvedValueOnce([{ ...mockCommentRow, comment_text: 'Updated' }]);

      const result = await service.updatePostComment(1, {
        comment_id: 1,
        comment_text: 'Updated',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Comment updated successfully');
    });

    it('should update flag_valid successfully', async () => {
      mockQuery.mockResolvedValueOnce([{ ...mockCommentRow, flag_valid: false }]);

      const result = await service.updatePostComment(1, {
        comment_id: 1,
        flag_valid: false,
      });

      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException if comment not found or not owner', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(
        service.updatePostComment(1, { comment_id: 99, comment_text: 'Hi' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.updatePostComment(1, { comment_id: 1, comment_text: 'Hi' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── deletePostComment ─────────────────────────────────────────────────────

  describe('deletePostComment', () => {
    it('should throw BadRequestException if comment_id is missing', async () => {
      await expect(
        service.deletePostComment(1, { comment_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user not authorized', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(
        service.deletePostComment(1, { comment_id: 99 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if comment already deleted', async () => {
      mockQuery.mockResolvedValueOnce([{ comment_id: 1, flag_valid: false }]);

      await expect(
        service.deletePostComment(1, { comment_id: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should soft delete comment and descendants successfully', async () => {
      mockQuery.mockResolvedValueOnce([{ comment_id: 1, flag_valid: true }]); // permission check

      mockQueryRunner.query
        .mockResolvedValueOnce([{ comment_id: 1 }, { comment_id: 2 }])  // soft delete comments
        .mockResolvedValueOnce([]);                                        // mark paths invalid

      const result = await service.deletePostComment(1, { comment_id: 1 });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Comment and its replies deleted successfully');
      expect(result.data.deleted_count).toBe(2);
      expect(result.data.deleted_comment_ids).toEqual([1, 2]);
    });

    it('should commit transaction on success', async () => {
      mockQuery.mockResolvedValueOnce([{ comment_id: 1, flag_valid: true }]);
      mockQueryRunner.query
        .mockResolvedValueOnce([{ comment_id: 1 }])
        .mockResolvedValueOnce([]);

      await service.deletePostComment(1, { comment_id: 1 });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction on failure', async () => {
      mockQuery.mockResolvedValueOnce([{ comment_id: 1, flag_valid: true }]);
      mockQueryRunner.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.deletePostComment(1, { comment_id: 1 }),
      ).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        service.deletePostComment(1, { comment_id: 1 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
