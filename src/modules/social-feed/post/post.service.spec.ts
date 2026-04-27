import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostContent } from './entities/post-content.entity';
import { PostInClass } from './entities/post-in-class.entity';
import { PostAttachment } from './entities/post-attachment.entity';
import { BullMQService } from 'src/common/bullmq/bullmq.service';
import { JobType, NOTIFICATION_QUEUE } from 'src/worker/worker.constants';
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
const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};
const mockRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
const mockBullMQService = {
  addJob: jest.fn(),
};

const mockPostRow = {
  post_id: 1,
  post_content_id: 10,
  title: 'Test Post',
  content: 'Content',
  post_type: 'normal',
  is_anonymous: false,
  created_at: new Date(),
  _user_sys_id: 5,
  _email: 'user@test.com',
  _profile_pic: null,
  _display_name: 'John Doe',
  _role_name: 'teacher',
  due_date: null,
  max_score: null,
  is_group: null,
  attachments: [],
};

describe('PostService', () => {
  let service: PostService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
        { provide: BullMQService, useValue: mockBullMQService },
        { provide: getRepositoryToken(PostContent), useValue: mockRepo },
        { provide: getRepositoryToken(PostInClass), useValue: mockRepo },
        { provide: getRepositoryToken(PostAttachment), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PostService>(PostService);

    jest.clearAllMocks();

    // Restore after clearAllMocks
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    mockLogger.debug.mockImplementation((..._args) => undefined);
    mockLogger.error.mockImplementation((..._args) => undefined);
    mockLogger.warn.mockImplementation((..._args) => undefined);
    mockLogger.log.mockImplementation((..._args) => undefined);
    mockLogger.verbose.mockImplementation((..._args) => undefined);
    mockBullMQService.addJob.mockReset();

    // Ensure the service uses our mock logger (override private field)
    (service as any).logger = mockLogger;
  });

  // ─── checkUserInSection ────────────────────────────────────────────────────

  describe('checkUserInSection', () => {
    it('should return true for enrolled student', async () => {
      mockQuery.mockResolvedValueOnce([{ 1: 1 }]);
      const result = await service.checkUserInSection(1, 1, 'uni student');
      expect(result).toBe(true);
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('FROM enrollment');
    });

    it('should return true for high school student', async () => {
      mockQuery.mockResolvedValueOnce([{ 1: 1 }]);
      const result = await service.checkUserInSection(
        1,
        1,
        'high school student',
      );
      expect(result).toBe(true);
    });

    it('should return false if student not enrolled', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.checkUserInSection(1, 1, 'uni student');
      expect(result).toBe(false);
    });

    it('should return true for teacher in section', async () => {
      mockQuery.mockResolvedValueOnce([{ 1: 1 }]);
      const result = await service.checkUserInSection(1, 1, 'teacher');
      expect(result).toBe(true);
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('FROM section_educator');
    });

    it('should return true for instructor in section', async () => {
      mockQuery.mockResolvedValueOnce([{ 1: 1 }]);
      const result = await service.checkUserInSection(1, 1, 'instructor');
      expect(result).toBe(true);
    });

    it('should return false for unknown role', async () => {
      const result = await service.checkUserInSection(1, 1, 'admin');
      expect(result).toBe(false);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  // ─── getPostsInClass ───────────────────────────────────────────────────────

  describe('getPostsInClass', () => {
    const dto = { section_id: 1, limit: 10, offset: 0 };

    it('should return posts successfully', async () => {
      mockQuery.mockResolvedValueOnce([mockPostRow]);
      const result = await service.getPostsInClass(dto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Posts retrieved successfully');
      expect(result.data).toHaveLength(1);
    });

    it('should return empty data when no posts found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getPostsInClass(dto);
      expect(result.data).toEqual([]);
    });

    it('should hide user info for anonymous posts', async () => {
      mockQuery.mockResolvedValueOnce([{ ...mockPostRow, is_anonymous: true }]);
      const result = await service.getPostsInClass(dto);
      expect(result.data[0].user.email).toBeNull();
      expect(result.data[0].user.profile_pic).toBeNull();
      expect(result.data[0].user.role_name).toBeNull();
    });

    it('should expose user info for non-anonymous posts', async () => {
      mockQuery.mockResolvedValueOnce([mockPostRow]);
      const result = await service.getPostsInClass(dto);
      expect(result.data[0].user.email).toBe('user@test.com');
      expect(result.data[0].user.role_name).toBe('teacher');
    });

    it('should filter by post type when provided', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.getPostsInClass({ ...dto, type: 'assignment' });
      const [calledQuery] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('post_type');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getPostsInClass(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── findPostOwner ─────────────────────────────────────────────────────────

  describe('findPostOwner', () => {
    it('should return post owner', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          post_content_id: 10,
          user_sys_id: 5,
          pic_flag_valid: true,
          pc_flag_valid: true,
        },
      ]);
      const result = await service.findPostOwner(1);
      expect(result.post_content_id).toBe(10);
      expect(result.user_sys_id).toBe(5);
    });

    it('should throw NotFoundException if post not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(service.findPostOwner(99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if post is soft deleted', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          post_content_id: 10,
          user_sys_id: 5,
          pic_flag_valid: false,
          pc_flag_valid: true,
        },
      ]);
      await expect(service.findPostOwner(1)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createPost ────────────────────────────────────────────────────────────

  describe('createPost', () => {
    const baseDto = {
      section_id: 1,
      title: 'Test',
      content: 'Content',
      post_type: 'normal' as any,
      is_anonymous: false,
    };

    const setupQueryRunner = (responses: any[]) => {
      let callCount = 0;
      mockQueryRunner.query.mockImplementation(() => {
        return Promise.resolve(responses[callCount++] ?? []);
      });
    };

    it('should create a normal post successfully', async () => {
      setupQueryRunner([
        [
          {
            post_content_id: 10,
            title: 'Test',
            content: 'Content',
            post_type: 'normal',
            is_anonymous: false,
            created_at: new Date(),
          },
        ],
        [{ post_id: 1 }],
      ]);
      const result = await service.createPost(1, baseDto);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Post created successfully');
    });

    it('should enqueue SOCIAL_FEED_POST_CREATED notification after creating post', async () => {
      setupQueryRunner([
        [
          {
            post_content_id: 10,
            title: 'Test',
            content: 'Content',
            post_type: 'normal',
            is_anonymous: false,
            created_at: new Date(),
          },
        ],
        [{ post_id: 1 }],
      ]);

      await service.createPost(5, { ...baseDto, section_id: 2 });

      expect(mockBullMQService.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: NOTIFICATION_QUEUE,
          job: JobType.SOCIAL_FEED_POST_CREATED,
          data: expect.objectContaining({
            type: JobType.SOCIAL_FEED_POST_CREATED,
            actor_id: 5,
            post_content_id: 10,
            post_type: 'normal',
          }),
        }),
      );
    });

    it('should throw BadRequestException if no section_id provided', async () => {
      await expect(
        service.createPost(1, {
          title: 'Test',
          content: 'Content',
          post_type: 'normal',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no title and content', async () => {
      await expect(
        service.createPost(1, { section_id: 1, post_type: 'normal' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no post_type', async () => {
      await expect(
        service.createPost(1, { section_id: 1, title: 'Test' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid attachments', async () => {
      await expect(
        service.createPost(1, {
          ...baseDto,
          attachments: [{ file_url: '', file_type: '' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for duplicate attachment URLs', async () => {
      await expect(
        service.createPost(1, {
          ...baseDto,
          attachments: [
            { file_url: 'same.jpg', file_type: 'image' },
            { file_url: 'same.jpg', file_type: 'image' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if assignment missing due_date', async () => {
      setupQueryRunner([
        [
          {
            post_content_id: 10,
            title: 'Test',
            content: 'Content',
            post_type: 'assignment',
            is_anonymous: false,
            created_at: new Date(),
          },
        ],
        [{ post_id: 1 }],
      ]);
      await expect(
        service.createPost(1, {
          ...baseDto,
          post_type: 'assignment' as any,
          is_group: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should support multiple section_ids', async () => {
      setupQueryRunner([
        [
          {
            post_content_id: 10,
            title: 'Test',
            content: 'Content',
            post_type: 'normal',
            is_anonymous: false,
            created_at: new Date(),
          },
        ],
        [{ post_id: 1 }],
        [{ post_id: 2 }],
      ]);
      const result = await service.createPost(1, {
        ...baseDto,
        section_ids: [1, 2],
      });
      expect(result.data.post_ids).toHaveLength(2);
    });
  });

  // ─── updatePost ────────────────────────────────────────────────────────────

  describe('updatePost', () => {
    it('should update post successfully by postContentId', async () => {
      mockQuery
        .mockResolvedValueOnce([{ user_sys_id: 1, post_content_id: 10 }]) // owner check
        .mockResolvedValueOnce([{ post_content_id: 10, title: 'Updated' }]) // update
        .mockResolvedValueOnce([{ section_id: 1 }])                          // section lookup
        .mockResolvedValueOnce([{ post_type: 'normal', title: 'Updated' }]); // post content lookup

      const result = await service.updatePost(1, 0, { title: 'Updated' }, 10);
      expect(result.success).toBe(true);
    });

    it('should enqueue SOCIAL_FEED_POST_UPDATED notification after updating post', async () => {
      mockQuery
        .mockResolvedValueOnce([{ user_sys_id: 1, post_content_id: 10 }])
        .mockResolvedValueOnce([{ post_content_id: 10, title: 'Updated' }])
        .mockResolvedValueOnce([{ section_id: 2 }])
        .mockResolvedValueOnce([{ post_type: 'normal', title: 'Updated' }]);

      await service.updatePost(1, 0, { title: 'Updated' }, 10);

      expect(mockBullMQService.addJob).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: NOTIFICATION_QUEUE,
          job: JobType.SOCIAL_FEED_POST_UPDATED,
          data: expect.objectContaining({
            type: JobType.SOCIAL_FEED_POST_UPDATED,
            actor_id: 1,
            post_content_id: 10,
          }),
        }),
      );
    });

    it('should throw NotFoundException if post not found by postContentId', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(
        service.updatePost(1, 0, { title: 'Updated' }, 99),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not post owner', async () => {
      mockQuery.mockResolvedValueOnce([
        { user_sys_id: 99, post_content_id: 10 },
      ]);
      await expect(
        service.updatePost(1, 0, { title: 'Updated' }, 10),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if neither postId nor postContentId provided', async () => {
      await expect(service.updatePost(1, 0, { title: 'Test' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update post by postId using findPostOwner', async () => {
      mockQuery
        .mockResolvedValueOnce([
          {
            post_content_id: 10,
            user_sys_id: 1,
            pic_flag_valid: true,
            pc_flag_valid: true,
          },
        ])                                                      // findPostOwner
        .mockResolvedValueOnce([{ post_content_id: 10, title: 'Updated' }]) // update
        .mockResolvedValueOnce([{ section_id: 1 }])            // section lookup for notification
        .mockResolvedValueOnce([{ post_type: 'normal', title: 'Updated' }]); // postContent lookup

      const result = await service.updatePost(1, 1, { title: 'Updated' });
      expect(result.success).toBe(true);
    });
  });

  // ─── updatePostAttachments ─────────────────────────────────────────────────

  describe('updatePostAttachments', () => {
    it('should throw NotFoundException if post not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(
        service.updatePostAttachments(1, 99, [], []),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockQuery.mockResolvedValueOnce([{ user_sys_id: 99 }]);
      await expect(
        service.updatePostAttachments(1, 10, [], []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update attachments successfully', async () => {
      mockQuery.mockResolvedValueOnce([{ user_sys_id: 1 }]);
      mockQueryRunner.query
        .mockResolvedValueOnce([]) // remove
        .mockResolvedValueOnce([
          {
            attachment_id: 1,
            file_url: 'new.jpg',
            file_type: 'image',
            original_name: 'new.jpg',
          },
        ]); // add

      const result = await service.updatePostAttachments(
        1,
        10,
        [{ file_url: 'new.jpg', file_type: 'image', original_name: 'new.jpg' }],
        [5],
      );
      expect(result.success).toBe(true);
      expect(result.data.added).toHaveLength(1);
      expect(result.data.removed).toEqual([5]);
    });
  });

  // ─── deletePost ────────────────────────────────────────────────────────────

  describe('deletePost', () => {
    it('should throw BadRequestException if neither postId nor postContentId provided', async () => {
      await expect(service.deletePost(1, 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if post not found by postId', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(service.deletePost(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not post owner', async () => {
      mockQuery
        .mockResolvedValueOnce([{ user_sys_id: 99, post_content_id: 10 }]) // owner check
        .mockResolvedValueOnce([{ post_id: 1 }]); // all post_ids
      await expect(service.deletePost(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete post successfully by postId', async () => {
      mockQuery
        .mockResolvedValueOnce([{ user_sys_id: 1, post_content_id: 10 }]) // owner check
        .mockResolvedValueOnce([{ post_id: 1 }]); // all post_ids

      mockQueryRunner.query
        .mockResolvedValueOnce([]) // get assignment_ids (empty → skip group steps)
        .mockResolvedValueOnce([]) // delete post_comment_path
        .mockResolvedValueOnce([]) // delete post_comment
        .mockResolvedValueOnce([]) // delete bookmark
        .mockResolvedValueOnce([]) // delete post_attachment
        .mockResolvedValueOnce([]) // delete post_in_class
        .mockResolvedValueOnce([]); // delete post_content

      const result = await service.deletePost(1, 1);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Post deleted successfully');

      const executedSql = mockQueryRunner.query.mock.calls.map(
        (c) => c[0] as string,
      );
      expect(executedSql.some((q) => q.includes('DELETE FROM bookmark'))).toBe(
        true,
      );
    });

    it('should delete post successfully by postContentId', async () => {
      mockQuery
        .mockResolvedValueOnce([{ user_sys_id: 1, post_content_id: 10 }]) // owner check
        .mockResolvedValueOnce([{ post_id: 1 }]); // post_ids

      mockQueryRunner.query
        .mockResolvedValueOnce([]) // get assignment_ids (empty → skip group steps)
        .mockResolvedValueOnce([]) // delete post_comment_path
        .mockResolvedValueOnce([]) // delete post_comment
        .mockResolvedValueOnce([]) // delete bookmark
        .mockResolvedValueOnce([]) // delete post_attachment
        .mockResolvedValueOnce([]) // delete post_in_class
        .mockResolvedValueOnce([]); // delete post_content

      const result = await service.deletePost(1, 0, 10);
      expect(result.success).toBe(true);

      const executedSql = mockQueryRunner.query.mock.calls.map(
        (c) => c[0] as string,
      );
      expect(executedSql.some((q) => q.includes('DELETE FROM bookmark'))).toBe(
        true,
      );
    });
  });

  // ─── searchPosts ───────────────────────────────────────────────────────────

  describe('searchPosts', () => {
    it('should return empty array for empty keyword', async () => {
      const result = await service.searchPosts({ keyword: '' });
      expect(result).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should return empty array for whitespace keyword', async () => {
      const result = await service.searchPosts({ keyword: '   ' });
      expect(result).toEqual([]);
    });

    it('should return search results', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          ...mockPostRow,
          user_sys_id: 5,
          section_id: 1,
          email: 'u@test.com',
          profile_pic: null,
          role_name: 'teacher',
        },
      ]);
      const result = (await service.searchPosts({ keyword: 'Test' })) as any;
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should hide user info for anonymous posts', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          ...mockPostRow,
          user_sys_id: 5,
          section_id: 1,
          is_anonymous: true,
          email: 'u@test.com',
        },
      ]);
      const result = (await service.searchPosts({ keyword: 'Test' })) as any;
      expect(result.data[0].user.email).toBeNull();
    });

    it('should filter by section_id when provided', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.searchPosts({ keyword: 'Test', section_id: 1 });
      const [calledQuery, calledValues] = mockQuery.mock.calls[0];
      expect(calledQuery).toContain('section_id');
      expect(calledValues).toContain(1);
    });

    it('should use ILIKE with wildcard for keyword', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.searchPosts({ keyword: 'math' });
      const [, calledValues] = mockQuery.mock.calls[0];
      expect(calledValues[0]).toBe('%math%');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.searchPosts({ keyword: 'Test' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
