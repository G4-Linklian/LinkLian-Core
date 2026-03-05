import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentService } from './assignment.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import { InternalServerErrorException } from '@nestjs/common';

const mockQuery = jest.fn();
const mockTransaction = jest.fn();

const mockDataSource = {
  query: mockQuery,
  transaction: mockTransaction,
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('AssignmentService', () => {
  let service: AssignmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AssignmentService>(AssignmentService);
    jest.clearAllMocks();
  });

  // ─── getClassAssignments ───────────────────────────────────────────────────

  describe('getClassAssignments', () => {
    const baseDto = { section_id: 1, offset: 0, limit: 10 };

    it('should call getStudentAssignments when role is "uni student"', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getClassAssignments(1, {
        ...baseDto,
        role: 'uni student',
      });
      expect(result).toEqual({ data: [] });
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should call getStudentAssignments when role is "high school student"', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getClassAssignments(1, {
        ...baseDto,
        role: 'high school student',
      });
      expect(result).toEqual({ data: [] });
    });

    it('should call getTeacherAssignments when role is "teacher"', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getClassAssignments(1, {
        ...baseDto,
        role: 'teacher',
      });
      expect(result).toEqual({ data: [] });
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        service.getClassAssignments(1, { ...baseDto, role: 'teacher' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── getPostAssignment ─────────────────────────────────────────────────────

  describe('getPostAssignment', () => {
    const mockPost = {
      post_content_id: 10,
      title: 'Test Assignment',
      content: 'Content',
      post_type: 'assignment',
      is_anonymous: false,
      created_at: new Date(),
      updated_at: new Date(),
      post_id: 1,
      section_id: 1,
      _user_sys_id: 99,
      _email: 'teacher@test.com',
      _profile_pic: null,
      _display_name: 'John Doe',
      _role_name: 'teacher',
      assignment_id: 5,
      due_date: new Date(),
      max_score: 100,
      is_group: true,
    };

    it('should return null if post not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getPostAssignment(999, 1, 'teacher');
      expect(result).toBeNull();
    });

    it('should return data for teacher role', async () => {
      mockQuery
        .mockResolvedValueOnce([mockPost])   // postQuery
        .mockResolvedValueOnce([])            // attachmentQuery
        .mockResolvedValueOnce([]);           // groupsQuery (teacher)

      const result = await service.getPostAssignment(1, 1, 'teacher');
      expect(result).not.toBeNull();
      expect(result!.data.post.title).toBe('Test Assignment');
    });

    it('should return data with submission for student role', async () => {
      const mockSubmission = {
        submission_id: 1,
        submitted_at: new Date(),
        marked_at: null,
        score: null,
        feedback: null,
        group_id: 1,
        group_name: 'Group A',
      };

      mockQuery
        .mockResolvedValueOnce([mockPost])      // postQuery
        .mockResolvedValueOnce([])              // attachmentQuery
        .mockResolvedValueOnce([mockSubmission]) // submissionQuery
        .mockResolvedValueOnce([]);             // groupQuery

      const result = await service.getPostAssignment(1, 2, 'uni student');
      expect(result).not.toBeNull();
      expect(result!.data.submission).toEqual(mockSubmission);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        service.getPostAssignment(1, 1, 'teacher'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── createGroup ──────────────────────────────────────────────────────────

  describe('createGroup', () => {
    const dto = {
      assignment_id: 1,
      group_name: 'Test Group',
      member_ids: [1, 2, 3],
    };

    it('should throw if userId is not in member_ids', async () => {
      await expect(service.createGroup(99, dto)).rejects.toThrow(
        'You must be a member of the group you create',
      );
    });

    it('should throw if assignment not found', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([]) // assignment check → not found
        };
        return cb(manager);
      });

      await expect(service.createGroup(1, dto)).rejects.toThrow('Invalid assignment');
    });

    it('should throw if user is not enrolled', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ assignment_id: 1 }]) // assignment found
            .mockResolvedValueOnce([]),                     // enrollment → not found
        };
        return cb(manager);
      });

      await expect(service.createGroup(1, dto)).rejects.toThrow(
        'You are not enrolled in this section',
      );
    });

    it('should create group successfully', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ assignment_id: 1 }])  // assignment found
            .mockResolvedValueOnce([{ student_id: 1 }])     // enrollment found
            .mockResolvedValueOnce([{ group_id: 10 }])      // insert group
            .mockResolvedValueOnce([]),                      // insert members
        };
        return cb(manager);
      });

      const result = await service.createGroup(1, dto);
      expect(result.success).toBe(true);
      expect(result.group.group_id).toBe(10);
    });
  });

  // ─── updateGroup ──────────────────────────────────────────────────────────

  describe('updateGroup', () => {
    const dto = {
      assignment_id: 1,
      group_id: 10,
      group_name: 'Updated Group',
      member_ids: [1, 2],
    };

    it('should throw if userId is not in member_ids', async () => {
      await expect(service.updateGroup(99, dto)).rejects.toThrow(
        'You cannot remove yourself from the group',
      );
    });

    it('should throw if group not found or user not a member', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = { query: jest.fn().mockResolvedValueOnce([]) };
        return cb(manager);
      });

      await expect(service.updateGroup(1, dto)).rejects.toThrow(
        'Group not found or you are not a member',
      );
    });

    it('should update group successfully', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ group_id: 10 }])  // group found
            .mockResolvedValueOnce([])                   // update name
            .mockResolvedValueOnce([])                   // delete old members
            .mockResolvedValueOnce([]),                  // insert new members
        };
        return cb(manager);
      });

      const result = await service.updateGroup(1, dto);
      expect(result.success).toBe(true);
      expect(result.group.group_name).toBe('Updated Group');
    });
  });

  // ─── getGroup ─────────────────────────────────────────────────────────────

  describe('getGroup', () => {
    it('should return null data if group not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getGroup(1, 1);
      expect(result).toEqual({ data: null });
    });

    it('should return group data', async () => {
      const mockGroup = { group_id: 1, group_name: 'Group A', members: [] };
      mockQuery.mockResolvedValueOnce([mockGroup]);
      const result = await service.getGroup(1, 1);
      expect(result.data).toEqual(mockGroup);
    });
  });

  // ─── getAllGroups ──────────────────────────────────────────────────────────

  describe('getAllGroups', () => {
    it('should return all groups', async () => {
      const mockGroups = [
        { group_id: 1, group_name: 'Group A', members: [] },
        { group_id: 2, group_name: 'Group B', members: [] },
      ];
      mockQuery.mockResolvedValueOnce(mockGroups);
      const result = await service.getAllGroups(1);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty array when no groups', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getAllGroups(1);
      expect(result.data).toHaveLength(0);
    });
  });

  // ─── searchAssignments ────────────────────────────────────────────────────

  describe('searchAssignments', () => {
    it('should return search results for student', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          assignment_id: 1,
          post_id: 1,
          title: 'Test',
          created_at: new Date(),
          subject_name_th: 'คณิต',
          subject_name_en: 'Math',
          assignment_type: 'งานเดี่ยว',
          is_group: false,
          due_date: new Date(),
          submitted_at: null,
          total_students: 10,
          submitted_count: 5,
          educators: [],
        },
      ]);

      const result = await service.searchAssignments(
        1, 1, 'Test', 'uni student', 50,
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should return search results for teacher', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.searchAssignments(
        1, 1, 'keyword', 'teacher', 50,
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        service.searchAssignments(1, 1, 'keyword', 'teacher', 50),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
