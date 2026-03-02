import { Test, TestingModule } from '@nestjs/testing';
import { CommunityCommentController } from './community-comment.controller';
import { CommunityCommentService } from './community-comment.service';
import {
  GetCommunityCommentsDto,
  CreateCommunityCommentDto,
  UpdateCommunityCommentDto,
  DeleteCommunityCommentDto,
} from './dto/community-comment.dto';

describe('CommunityCommentController', () => {
  let controller: CommunityCommentController;
  let service: CommunityCommentService;

  beforeEach(async () => {
    const mockService = {
      getComments: jest.fn(),
      createComment: jest.fn(),
      updateComment: jest.fn(),
      deleteComment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityCommentController],
      providers: [{ provide: CommunityCommentService, useValue: mockService }],
    }).compile();

    controller = module.get<CommunityCommentController>(
      CommunityCommentController,
    );
    service = module.get<CommunityCommentService>(CommunityCommentService);
  });

  describe('get', () => {
    it('should retrieve comments for a post', async () => {
      const dto: GetCommunityCommentsDto = {
        post_commu_id: 1,
        limit: 20,
        offset: 0,
      };

      const mockComments = [
        {
          comment_id: 1,
          comment_text: 'Great post!',
          user_sys_id: 1,
          post_commu_id: 1,
          created_at: new Date(),
        },
      ];

      (service.getComments as jest.Mock).mockResolvedValueOnce(mockComments);

      const result = await controller.get(dto);

      expect(service.getComments).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockComments);
    });

    it('should get comments with default parameters', async () => {
      const dto: GetCommunityCommentsDto = { post_commu_id: 5 };

      (service.getComments as jest.Mock).mockResolvedValueOnce([]);

      await controller.get(dto);

      expect(service.getComments).toHaveBeenCalledWith(dto);
    });

    it('should pass post_commu_id to service', async () => {
      const dto: GetCommunityCommentsDto = {
        post_commu_id: 100,
        limit: 50,
        offset: 10,
      };

      (service.getComments as jest.Mock).mockResolvedValueOnce([]);

      await controller.get(dto);

      const callArgs = (service.getComments as jest.Mock).mock.calls[0][0];
      expect(callArgs.post_commu_id).toBe(100);
    });

    it('should return array of comments', async () => {
      const dto: GetCommunityCommentsDto = { post_commu_id: 1 };

      const mockComments = [
        { comment_id: 1, comment_text: 'Comment 1' },
        { comment_id: 2, comment_text: 'Comment 2' },
        { comment_id: 3, comment_text: 'Comment 3' },
      ];

      (service.getComments as jest.Mock).mockResolvedValueOnce(mockComments);

      const result = await controller.get(dto);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('should return empty array if no comments', async () => {
      const dto: GetCommunityCommentsDto = { post_commu_id: 999 };

      (service.getComments as jest.Mock).mockResolvedValueOnce([]);

      const result = await controller.get(dto);

      expect(result).toEqual([]);
    });

    it('should include pagination parameters', async () => {
      const dto: GetCommunityCommentsDto = {
        post_commu_id: 1,
        limit: 100,
        offset: 50,
      };

      (service.getComments as jest.Mock).mockResolvedValueOnce([]);

      await controller.get(dto);

      const callArgs = (service.getComments as jest.Mock).mock.calls[0][0];
      expect(callArgs.limit).toBe(100);
      expect(callArgs.offset).toBe(50);
    });

    it('should handle comment tree structure', async () => {
      const dto: GetCommunityCommentsDto = { post_commu_id: 1 };

      const mockComments = [
        {
          comment_id: 1,
          comment_text: 'Parent comment',
          children: [
            {
              comment_id: 2,
              comment_text: 'Reply to parent',
              parent_id: 1,
            },
          ],
        },
      ];

      (service.getComments as jest.Mock).mockResolvedValueOnce(mockComments);

      const result = await controller.get(dto);

      expect(result[0]).toHaveProperty('children');
    });
  });

  describe('create', () => {
    it('should create a comment', async () => {
      const userIdHeader = '1';
      const dto: CreateCommunityCommentDto = {
        post_commu_id: 1,
        comment_text: 'New comment',
      };

      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 100,
        comment_text: dto.comment_text,
        post_commu_id: dto.post_commu_id,
        user_sys_id: 1,
      });

      const result: any = await controller.create(userIdHeader, dto);

      expect(service.createComment).toHaveBeenCalledWith(1, dto);
      expect(result.comment_id).toBe(100);
    });

    it('should convert header userId to number', async () => {
      const userIdHeader = '42';
      const dto: CreateCommunityCommentDto = {
        post_commu_id: 1,
        comment_text: 'Comment',
      };

      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 1,
      });

      await controller.create(userIdHeader, dto);

      const callArgs = (service.createComment as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(42);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should include dto in service call', async () => {
      const userIdHeader = '1';
      const dto: CreateCommunityCommentDto = {
        post_commu_id: 5,
        comment_text: 'Test comment',
        parent_id: 10,
      };

      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 1,
      });

      await controller.create(userIdHeader, dto);

      const callArgs = (service.createComment as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toEqual(dto);
    });

    it('should create comment with parent_id', async () => {
      const userIdHeader = '1';
      const dto: CreateCommunityCommentDto = {
        post_commu_id: 1,
        comment_text: 'Reply comment',
        parent_id: 50,
      };

      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 101,
        parent_id: 50,
      });

      const result = await controller.create(userIdHeader, dto);

      expect((result as any).parent_id).toBe(50);
    });

    it('should return created comment with id', async () => {
      const userIdHeader = '1';
      const dto: CreateCommunityCommentDto = {
        post_commu_id: 1,
        comment_text: 'New comment',
      };

      const createdComment = {
        comment_id: 999,
        comment_text: dto.comment_text,
        user_sys_id: 1,
        created_at: new Date(),
      };

      (service.createComment as jest.Mock).mockResolvedValueOnce(
        createdComment,
      );

      const result = await controller.create(userIdHeader, dto);

      expect(result).toHaveProperty('comment_id', 999);
    });

    it('should set user_sys_id from header', async () => {
      const userIdHeader = '123';
      const dto: CreateCommunityCommentDto = {
        post_commu_id: 1,
        comment_text: 'Comment',
      };

      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 1,
        user_sys_id: 123,
      });

      await controller.create(userIdHeader, dto);

      const callArgs = (service.createComment as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(123);
    });
  });

  describe('update', () => {
    it('should update a comment', async () => {
      const userIdHeader = '1';
      const dto: UpdateCommunityCommentDto = {
        comment_id: 100,
        comment_text: 'Updated content',
      };

      (service.updateComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 100,
        comment_text: dto.comment_text,
      });

      const result = await controller.update(userIdHeader, dto);

      expect(service.updateComment).toHaveBeenCalledWith(1, dto);
      expect((result as any).comment_text).toBe(dto.comment_text);
    });

    it('should convert header userId to number', async () => {
      const userIdHeader = '55';
      const dto: UpdateCommunityCommentDto = {
        comment_id: 100,
        comment_text: 'Updated',
      };

      (service.updateComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 100,
      });

      await controller.update(userIdHeader, dto);

      const callArgs = (service.updateComment as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(55);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should pass dto to service', async () => {
      const userIdHeader = '1';
      const dto: UpdateCommunityCommentDto = {
        comment_id: 200,
        comment_text: 'New content',
      };

      (service.updateComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 200,
      });

      await controller.update(userIdHeader, dto);

      const callArgs = (service.updateComment as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toEqual(dto);
    });

    it('should return updated comment', async () => {
      const userIdHeader = '1';
      const dto: UpdateCommunityCommentDto = {
        comment_id: 100,
        comment_text: 'Updated content',
      };

      const updatedComment = {
        comment_id: 100,
        comment_text: 'Updated content',
        updated_at: new Date(),
      };

      (service.updateComment as jest.Mock).mockResolvedValueOnce(
        updatedComment,
      );

      const result = await controller.update(userIdHeader, dto);

      expect((result as any).comment_id).toBe(100);
      expect((result as any).comment_text).toBe('Updated content');
    });

    it('should verify user ownership during update', async () => {
      const userIdHeader = '1';
      const dto: UpdateCommunityCommentDto = {
        comment_id: 100,
        comment_text: 'Updated',
      };

      (service.updateComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 100,
      });

      await controller.update(userIdHeader, dto);

      const callArgs = (service.updateComment as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete a comment', async () => {
      const userIdHeader = '1';
      const dto: DeleteCommunityCommentDto = { comment_id: 100 };

      (service.deleteComment as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const result = await controller.delete(userIdHeader, dto);

      expect(service.deleteComment).toHaveBeenCalledWith(1, 100);
      expect(result.success).toBe(true);
    });

    it('should convert header userId to number', async () => {
      const userIdHeader = '77';
      const dto: DeleteCommunityCommentDto = { comment_id: 100 };

      (service.deleteComment as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.delete(userIdHeader, dto);

      const callArgs = (service.deleteComment as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(77);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should extract comment_id from dto', async () => {
      const userIdHeader = '1';
      const dto: DeleteCommunityCommentDto = { comment_id: 250 };

      (service.deleteComment as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.delete(userIdHeader, dto);

      const callArgs = (service.deleteComment as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(250);
    });

    it('should return success response', async () => {
      const userIdHeader = '1';
      const dto: DeleteCommunityCommentDto = { comment_id: 100 };

      (service.deleteComment as jest.Mock).mockResolvedValueOnce({
        success: true,
        deleted_id: 100,
      });

      const result = await controller.delete(userIdHeader, dto);

      expect(result.success).toBe(true);
    });

    it('should verify user ownership during delete', async () => {
      const userIdHeader = '88';
      const dto: DeleteCommunityCommentDto = { comment_id: 100 };

      (service.deleteComment as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.delete(userIdHeader, dto);

      const callArgs = (service.deleteComment as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(88);
    });

    it('should handle cascading delete', async () => {
      const userIdHeader = '1';
      const dto: DeleteCommunityCommentDto = { comment_id: 100 };

      (service.deleteComment as jest.Mock).mockResolvedValueOnce({
        success: true,
        deleted_count: 5,
      });

      const result = await controller.delete(userIdHeader, dto);

      expect((result as any).deleted_count).toBe(5);
    });
  });

  describe('Header validation', () => {
    it('should parse valid numeric x-user-id in create', async () => {
      const validUserIds = ['1', '10', '999', '100'];

      for (const userId of validUserIds) {
        (service.createComment as jest.Mock).mockResolvedValueOnce({
          comment_id: 1,
        });

        await controller.create(userId, {
          post_commu_id: 1,
          comment_text: 'Test',
        });
      }

      expect(service.createComment).toHaveBeenCalledTimes(4);
    });

    it('should parse valid numeric x-user-id in update', async () => {
      const validUserIds = ['5', '50', '500'];

      for (const userId of validUserIds) {
        (service.updateComment as jest.Mock).mockResolvedValueOnce({
          comment_id: 1,
        });

        await controller.update(userId, {
          comment_id: 1,
          comment_text: 'Test',
        });
      }

      expect(service.updateComment).toHaveBeenCalledTimes(3);
    });

    it('should parse valid numeric x-user-id in delete', async () => {
      const validUserIds = ['3', '30', '300'];

      for (const userId of validUserIds) {
        (service.deleteComment as jest.Mock).mockResolvedValueOnce({
          success: true,
        });

        await controller.delete(userId, { comment_id: 1 });
      }

      expect(service.deleteComment).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error handling', () => {
    it('should propagate service errors in get', async () => {
      const dto: GetCommunityCommentsDto = { post_commu_id: 1 };

      (service.getComments as jest.Mock).mockRejectedValueOnce(
        new Error('Service error'),
      );

      await expect(controller.get(dto)).rejects.toThrow('Service error');
    });

    it('should propagate service errors in create', async () => {
      const userIdHeader = '1';
      const dto: CreateCommunityCommentDto = {
        post_commu_id: 1,
        comment_text: 'Test',
      };

      (service.createComment as jest.Mock).mockRejectedValueOnce(
        new Error('Creation failed'),
      );

      await expect(controller.create(userIdHeader, dto)).rejects.toThrow(
        'Creation failed',
      );
    });

    it('should propagate service errors in update', async () => {
      const userIdHeader = '1';
      const dto: UpdateCommunityCommentDto = {
        comment_id: 100,
        comment_text: 'Test',
      };

      (service.updateComment as jest.Mock).mockRejectedValueOnce(
        new Error('Update failed'),
      );

      await expect(controller.update(userIdHeader, dto)).rejects.toThrow(
        'Update failed',
      );
    });

    it('should propagate service errors in delete', async () => {
      const userIdHeader = '1';
      const dto: DeleteCommunityCommentDto = { comment_id: 100 };

      (service.deleteComment as jest.Mock).mockRejectedValueOnce(
        new Error('Delete failed'),
      );

      await expect(controller.delete(userIdHeader, dto)).rejects.toThrow(
        'Delete failed',
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should get comments then create a new one', async () => {
      const getDto: GetCommunityCommentsDto = { post_commu_id: 1 };
      const createDto: CreateCommunityCommentDto = {
        post_commu_id: 1,
        comment_text: 'New comment',
      };

      // Get comments
      const existingComments = [
        { comment_id: 1, comment_text: 'Existing comment' },
      ];
      (service.getComments as jest.Mock).mockResolvedValueOnce(
        existingComments,
      );

      const comments = await controller.get(getDto);
      expect(comments).toHaveLength(1);

      // Create comment
      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 2,
        comment_text: createDto.comment_text,
      });

      const newComment = await controller.create('1', createDto);
      expect((newComment as any).comment_id).toBe(2);
    });

    it('should create, update, and delete a comment', async () => {
      const userId = '1';

      // Create
      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 100,
        comment_text: 'Initial content',
      });

      const created = await controller.create(userId, {
        post_commu_id: 1,
        comment_text: 'Initial content',
      });
      expect((created as any).comment_id).toBe(100);

      // Update
      (service.updateComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 100,
        comment_text: 'Updated content',
      });

      const updated = await controller.update(userId, {
        comment_id: 100,
        comment_text: 'Updated content',
      });
      expect((updated as any).comment_text).toBe('Updated content');

      // Delete
      (service.deleteComment as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const deleted = await controller.delete(userId, {
        comment_id: 100,
      });
      expect(deleted.success).toBe(true);
    });

    it('should get comments with replies', async () => {
      const dto: GetCommunityCommentsDto = {
        post_commu_id: 1,
        limit: 20,
        offset: 0,
      };

      const commentsWithReplies = [
        {
          comment_id: 1,
          comment_text: 'Parent comment',
          children: [
            { comment_id: 2, comment_text: 'Reply 1', parent_id: 1 },
            { comment_id: 3, comment_text: 'Reply 2', parent_id: 1 },
          ],
        },
      ];

      (service.getComments as jest.Mock).mockResolvedValueOnce(
        commentsWithReplies,
      );

      const result = await controller.get(dto);

      expect(result[0]).toHaveProperty('children');
      expect(result[0].children).toHaveLength(2);
    });

    it('should create reply to existing comment', async () => {
      const userId = '1';
      const parentCommentId = 50;

      // Create reply
      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 101,
        parent_comment_id: parentCommentId,
        comment_text: 'Reply to parent',
      });

      const reply = await controller.create(userId, {
        post_commu_id: 1,
        comment_text: 'Reply to parent',
        parent_id: parentCommentId,
      });

      expect((reply as any).parent_id).toBe(parentCommentId);
    });

    it('should update multiple comments', async () => {
      const userId = '1';

      // Update comment 1
      (service.updateComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 1,
        comment_text: 'Updated 1',
      });

      await controller.update(userId, {
        comment_id: 1,
        comment_text: 'Updated 1',
      });

      // Update comment 2
      (service.updateComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 2,
        comment_text: 'Updated 2',
      });

      await controller.update(userId, {
        comment_id: 2,
        comment_text: 'Updated 2',
      });

      expect(service.updateComment).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data transformation', () => {
    it('should transform request parameters correctly in get', async () => {
      const dto: GetCommunityCommentsDto = {
        post_commu_id: 42,
        limit: 25,
        offset: 5,
      };

      (service.getComments as jest.Mock).mockResolvedValueOnce([]);

      await controller.get(dto);

      expect(service.getComments).toHaveBeenCalledWith({
        post_commu_id: 42,
        limit: 25,
        offset: 5,
      });
    });

    it('should transform userId correctly in all operations', async () => {
      const userId = '999';

      const createDto: CreateCommunityCommentDto = {
        post_commu_id: 1,
        comment_text: 'Test',
      };
      (service.createComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 1,
      });
      await controller.create(userId, createDto);

      const updateDto: UpdateCommunityCommentDto = {
        comment_id: 1,
        comment_text: 'Test',
      };
      (service.updateComment as jest.Mock).mockResolvedValueOnce({
        comment_id: 1,
      });
      await controller.update(userId, updateDto);

      const deleteDto: DeleteCommunityCommentDto = { comment_id: 1 };
      (service.deleteComment as jest.Mock).mockResolvedValueOnce({
        success: true,
      });
      await controller.delete(userId, deleteDto);

      expect(service.createComment).toHaveBeenCalledWith(999, createDto);
      expect(service.updateComment).toHaveBeenCalledWith(999, updateDto);
      expect(service.deleteComment).toHaveBeenCalledWith(999, 1);
    });
  });
});
