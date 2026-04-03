import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentService } from './assignment.service';
import { DataSource } from 'typeorm';
import { AppLogger } from '../../common/logger/app-logger.service';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

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
  debug: jest.fn(),
  verbose: jest.fn(),
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

    // Restore implementations after clearAllMocks
    mockLogger.log.mockImplementation((..._args) => undefined);
    mockLogger.error.mockImplementation((..._args) => undefined);
    mockLogger.warn.mockImplementation((..._args) => undefined);
    mockLogger.debug.mockImplementation((..._args) => undefined);
    mockLogger.verbose.mockImplementation((..._args) => undefined);

    // Ensure service uses our mock logger
    (service as any).logger = mockLogger;
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
      expect(result.success).toBe(true);
      expect(result.message).toBe('Assignments retrieved successfully');
      expect(result.data).toEqual([]);
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should call getStudentAssignments when role is "high school student"', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getClassAssignments(1, {
        ...baseDto,
        role: 'high school student',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Assignments retrieved successfully');
      expect(result.data).toEqual([]);
    });

    it('should call getTeacherAssignments when role is "teacher"', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getClassAssignments(1, {
        ...baseDto,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Assignments retrieved successfully');
      expect(result.data).toEqual([]);
    });

    it('should call getTeacherAssignments when role is "instructor"', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getClassAssignments(1, {
        ...baseDto,
        role: 'instructor',
      });
      expect(result.success).toBe(true);
      expect(result.message).toBe('Assignments retrieved successfully');
      expect(result.data).toEqual([]);
    });

    it('should map student assignment rows correctly', async () => {
      const mockRow = {
        assignment_id: 1,
        post_id: 10,
        title: 'HW1',
        created_at: new Date('2024-01-01'),
        subject_name_th: 'คณิต',
        subject_name_en: 'Math',
        assignment_type: 'งานเดี่ยว',
        is_group: false,
        due_date: new Date('2024-02-01'),
        submitted_at: null,
        total_students: '30',
        submitted_count: '10',
        educators: [],
      };
      mockQuery.mockResolvedValueOnce([mockRow]);
      const result = await service.getClassAssignments(1, {
        ...baseDto,
        role: 'uni student',
      });
      expect(result.data[0].total_students).toBe(30);
      expect(result.data[0].submitted_count).toBe(10);
      expect(result.data[0].title).toBe('HW1');
    });

    it('should map teacher assignment rows and include total_groups/submitted_groups', async () => {
      const mockRow = {
        assignment_id: 2,
        post_id: 20,
        title: 'HW2',
        created_at: new Date(),
        subject_name_th: 'ฟิสิกส์',
        subject_name_en: 'Physics',
        assignment_type: 'งานกลุ่ม',
        is_group: true,
        due_date: new Date(),
        total_students: '25',
        submitted_count: '5',
        total_groups: '8',
        submitted_groups: '3',
        educators: [],
      };
      mockQuery.mockResolvedValueOnce([mockRow]);
      const result = await service.getClassAssignments(1, {
        ...baseDto,
        role: 'teacher',
      });
      expect(result.data[0].total_groups).toBe(8);
      expect(result.data[0].submitted_groups).toBe(3);
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
        .mockResolvedValueOnce([mockPost]) // postQuery
        .mockResolvedValueOnce([]) // attachmentQuery
        .mockResolvedValueOnce([]); // groupsQuery (teacher)

      const result = await service.getPostAssignment(1, 1, 'teacher');
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.data.post.title).toBe('Test Assignment');
    });

    it('should mask display_name for anonymous posts', async () => {
      mockQuery
        .mockResolvedValueOnce([{ ...mockPost, is_anonymous: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getPostAssignment(1, 1, 'teacher');
      expect(result!.data.post.user.display_name).not.toBe('John Doe');
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
        .mockResolvedValueOnce([mockPost])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockSubmission]) // submissionQuery
        .mockResolvedValueOnce([]) // submissionAttachmentQuery
        .mockResolvedValueOnce([]); // groupQuery

      const result = await service.getPostAssignment(1, 2, 'uni student');
      expect(result!.data.submission.submission_id).toBe(1);
    });

    it('should return student group with deleted member pattern', async () => {
      const mockGroup = {
        group_id: 10,
        group_name: 'Group A',
        members: [
          {
            user_sys_id: 8,
            first_name: 'กิตติกร',
            last_name: 'พิมเทศ',
            profile_pic: null,
            name: 'กิตติกร พิมเทศ',
          },
          {
            user_sys_id: null,
            first_name: '',
            last_name: '',
            profile_pic: null,
            name: 'ไม่มีบัญชีผู้ใช้งาน',
          },
        ],
      };

      mockQuery
        .mockResolvedValueOnce([mockPost])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockGroup]);

      const result = await service.getPostAssignment(1, 2, 'uni student');
      expect(result!.data.group.group_id).toBe(10);
      expect(result!.data.group.members[1].user_sys_id).toBeNull();
      expect(result!.data.group.members[1].name).toBe(
        'ไม่มีบัญชีผู้ใช้งาน',
      );
    });

    it('should return null submission when student has not submitted', async () => {
      mockQuery
        .mockResolvedValueOnce([mockPost])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]) // no submission
        .mockResolvedValueOnce([]); // group query

      const result = await service.getPostAssignment(
        1,
        2,
        'high school student',
      );
      expect(result!.data.submission).toBeNull();
    });

    it('should return groups array for teacher', async () => {
      const mockGroups = [
        { group_id: 1, group_name: 'G1', members: [] },
        { group_id: 2, group_name: 'G2', members: [] },
      ];
      mockQuery
        .mockResolvedValueOnce([mockPost])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockGroups);

      const result = await service.getPostAssignment(1, 1, 'teacher');
      expect(result!.data.groups).toHaveLength(2);
    });

    it('should include attachments in both top-level and post payload', async () => {
      const mockAttachments = [
        {
          attachment_id: 101,
          file_url: 'https://cdn.example.com/a.pdf',
          file_type: 'pdf',
          original_name: 'a.pdf',
        },
      ];

      mockQuery
        .mockResolvedValueOnce([mockPost]) // postQuery
        .mockResolvedValueOnce(mockAttachments) // attachmentQuery
        .mockResolvedValueOnce([]); // groupsQuery (teacher)

      const result = await service.getPostAssignment(1, 1, 'teacher');
      expect(result).not.toBeNull();
      expect(result!.data.attachments).toHaveLength(1);
      expect(result!.data.post.attachments).toHaveLength(1);
      expect(result!.data.post.attachments[0].file_url).toBe(
        'https://cdn.example.com/a.pdf',
      );
    });

    it('should return user_sys_id as null when post creator is deleted', async () => {
      // LEFT JOIN user_sys / LEFT JOIN role → _user_sys_id อาจเป็น null เมื่อ user ถูกลบ
      const deletedUserPost = {
        ...mockPost,
        _user_sys_id: null,
        _email: null,
        _profile_pic: null,
        _display_name: null,
        _role_name: null,
        is_anonymous: false,
      };

      mockQuery
        .mockResolvedValueOnce([deletedUserPost]) // postQuery
        .mockResolvedValueOnce([])                // attachmentQuery
        .mockResolvedValueOnce([]);               // groupsQuery (teacher)

      const result = await service.getPostAssignment(1, 1, 'teacher');
      expect(result).not.toBeNull();
      expect(result!.data.post.user.user_sys_id).toBeNull();
      expect(result!.data.post.user.email).toBeNull();
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getPostAssignment(1, 1, 'teacher')).rejects.toThrow(
        InternalServerErrorException,
      );
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
        const manager = { query: jest.fn().mockResolvedValueOnce([]) };
        return cb(manager);
      });
      await expect(service.createGroup(1, dto)).rejects.toThrow(
        'Invalid assignment',
      );
    });

    it('should throw if user is not enrolled', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ assignment_id: 1 }])
            .mockResolvedValueOnce([]),
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
            .mockResolvedValueOnce([{ assignment_id: 1 }])
            .mockResolvedValueOnce([{ student_id: 1 }])
            .mockResolvedValueOnce([
              { user_sys_id: 1 },
              { user_sys_id: 2 },
              { user_sys_id: 3 },
            ])
            .mockResolvedValueOnce([{ group_id: 10 }])
            .mockResolvedValueOnce([]),
        };
        return cb(manager);
      });
      const result = await service.createGroup(1, dto);
      expect(result.success).toBe(true);
      expect(result.data.group_id).toBe(10);
      expect(result.data.group_name).toBe('Test Group');
      expect(result.data.members).toHaveLength(3);
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
            .mockResolvedValueOnce([{ group_id: 10 }])
            .mockResolvedValueOnce([{ user_sys_id: 1 }, { user_sys_id: 2 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
        };
        return cb(manager);
      });
      const result = await service.updateGroup(1, dto);
      expect(result.success).toBe(true);
      expect(result.data.group_name).toBe('Updated Group');
      expect(result.data.members).toHaveLength(2);
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

    it('should keep deleted members in group data', async () => {
      const mockGroup = {
        group_id: 1,
        group_name: 'Group A',
        members: [
          {
            user_sys_id: 8,
            first_name: 'กิตติกร',
            last_name: 'พิมเทศ',
            profile_pic: null,
            name: 'กิตติกร พิมเทศ',
          },
          {
            user_sys_id: null,
            first_name: '',
            last_name: '',
            profile_pic: null,
            name: 'ไม่มีบัญชีผู้ใช้งาน',
          },
        ],
      };
      mockQuery.mockResolvedValueOnce([mockGroup]);
      const result = await service.getGroup(8, 1);
      expect(result.data.members).toHaveLength(2);
      expect(result.data.members[1].user_sys_id).toBeNull();
      expect(result.data.members[1].first_name).toBe('');
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
      expect(result.message).toBe('Groups retrieved successfully');
    });

    it('should return empty array when no groups', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getAllGroups(1);
      expect(result.data).toHaveLength(0);
    });

    it('should include deleted members in group list', async () => {
      const mockGroups = [
        {
          group_id: 1,
          group_name: 'Group A',
          members: [
            {
              user_sys_id: null,
              code: null,
              first_name: '',
              last_name: '',
              profile_pic: null,
              name: 'ไม่มีบัญชีผู้ใช้งาน',
            },
          ],
        },
      ];
      mockQuery.mockResolvedValueOnce(mockGroups);
      const result = await service.getAllGroups(1);
      expect(result.data[0].members[0].user_sys_id).toBeNull();
      expect(result.data[0].members[0].name).toBe('ไม่มีบัญชีผู้ใช้งาน');
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
          total_students: '10',
          submitted_count: '5',
          educators: [],
        },
      ]);
      const result = await service.searchAssignments(
        1,
        1,
        'Test',
        'uni student',
        50,
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].total_students).toBe(10);
    });

    it('should return search results for teacher', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.searchAssignments(
        1,
        1,
        'keyword',
        'teacher',
        50,
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should include userId in params for student queries', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.searchAssignments(5, 1, 'test', 'uni student', 10);
      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe(1); // sectionId
      expect(params[1]).toBe(5); // userId
    });

    it('should not include userId in params for teacher queries', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await service.searchAssignments(5, 1, 'test', 'teacher', 10);
      const [, params] = mockQuery.mock.calls[0];
      expect(params[0]).toBe(1); // sectionId
      expect(params).not.toContain(5); // no userId
    });

    it('should throw InternalServerErrorException on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        service.searchAssignments(1, 1, 'keyword', 'teacher', 50),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── getSubmission ────────────────────────────────────────────────────────

  describe('getSubmission', () => {
    const mockSubmissionRow = {
      submission_id: 1,
      assignment_id: 5,
      group_id: 10,
      submitted_at: new Date(),
      marked_at: null,
      score: null,
      feedback: null,
      group_name: 'Group A',
      due_date: new Date(Date.now() + 86400000), // future
      max_score: 100,
      is_group: false,
    };

    it('should throw BadRequestException if submission not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(service.getSubmission(1, 999)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return submission with can_edit=true when member and not past due', async () => {
      mockQuery
        .mockResolvedValueOnce([mockSubmissionRow])
        .mockResolvedValueOnce([]) // attachments
        .mockResolvedValueOnce([{ group_id: 10 }]) // is member
        .mockResolvedValueOnce([]); // members

      const result = await service.getSubmission(1, 1);
      expect(result.success).toBe(true);
      expect(result.data.can_edit).toBe(true);
      expect(result.data.is_member).toBe(true);
    });

    it('should return can_edit=false when user is not a member', async () => {
      mockQuery
        .mockResolvedValueOnce([mockSubmissionRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]) // not member
        .mockResolvedValueOnce([]);

      const result = await service.getSubmission(1, 1);
      expect(result.data.can_edit).toBe(false);
      expect(result.data.is_member).toBe(false);
    });

    it('should return can_edit=false when past due even if member', async () => {
      const pastDue = {
        ...mockSubmissionRow,
        due_date: new Date(Date.now() - 86400000),
      };
      mockQuery
        .mockResolvedValueOnce([pastDue])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ group_id: 10 }])
        .mockResolvedValueOnce([]);

      const result = await service.getSubmission(1, 1);
      expect(result.data.is_past_due).toBe(true);
      expect(result.data.can_edit).toBe(false);
    });

    it('should return submission attachments', async () => {
      const mockAttachment = {
        attachment_id: 1,
        file_url: 'a.pdf',
        original_name: 'a.pdf',
        file_type: 'pdf',
      };
      mockQuery
        .mockResolvedValueOnce([mockSubmissionRow])
        .mockResolvedValueOnce([mockAttachment])
        .mockResolvedValueOnce([{ group_id: 10 }])
        .mockResolvedValueOnce([]);

      const result = await service.getSubmission(1, 1);
      expect(result.data.attachments).toHaveLength(1);
    });

    it('should return deleted members in submission detail', async () => {
      const deletedMember = {
        user_sys_id: null,
        first_name: '',
        last_name: '',
        profile_pic: null,
        name: 'ไม่มีบัญชีผู้ใช้งาน',
      };
      mockQuery
        .mockResolvedValueOnce([mockSubmissionRow])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ group_id: 10 }])
        .mockResolvedValueOnce([deletedMember]);

      const result = await service.getSubmission(1, 1);
      expect(result.data.members[0].user_sys_id).toBeNull();
      expect(result.data.members[0].name).toBe('ไม่มีบัญชีผู้ใช้งาน');
      expect(result.data.members[0].first_name).toBe('');
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getSubmission(1, 1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createSubmission ─────────────────────────────────────────────────────

  describe('createSubmission', () => {
    const dto = { assignment_id: 1, group_id: 10 };

    it('should throw BadRequestException if assignment not found', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = { query: jest.fn().mockResolvedValueOnce([]) };
        return cb(manager);
      });
      await expect(service.createSubmission(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user not a member of group', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([
              { assignment_id: 1, due_date: null, is_group: true },
            ])
            .mockResolvedValueOnce([]), // not member
        };
        return cb(manager);
      });
      await expect(service.createSubmission(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if submission already exists', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([
              { assignment_id: 1, due_date: null, is_group: true },
            ])
            .mockResolvedValueOnce([{ group_id: 10 }])
            .mockResolvedValueOnce([{ submission_id: 99 }]), // duplicate
        };
        return cb(manager);
      });
      await expect(service.createSubmission(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create submission successfully without files', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([
              { assignment_id: 1, due_date: null, is_group: true },
            ])
            .mockResolvedValueOnce([{ group_id: 10 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
              { submission_id: 1, submitted_at: new Date() },
            ]),
        };
        return cb(manager);
      });

      const result = await service.createSubmission(1, dto);
      expect(result.success).toBe(true);
      expect(result.data.submission_id).toBe(1);
      expect(result.data.attachments).toHaveLength(0);
    });

    it('should create submission with files', async () => {
      const dtoWithFiles = {
        ...dto,
        files: [
          { file_url: 'f.pdf', original_name: 'f.pdf', file_type: 'pdf' },
        ],
      };
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([
              { assignment_id: 1, due_date: null, is_group: true },
            ])
            .mockResolvedValueOnce([{ group_id: 10 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
              { submission_id: 1, submitted_at: new Date() },
            ])
            .mockResolvedValueOnce([
              {
                attachment_id: 1,
                file_url: 'f.pdf',
                original_name: 'f.pdf',
                file_type: 'pdf',
              },
            ]),
        };
        return cb(manager);
      });

      const result = await service.createSubmission(1, dtoWithFiles);
      expect(result.data.attachments).toHaveLength(1);
    });

    it('should auto-resolve group_id for individual assignment (existing solo group)', async () => {
      const individualDto = { assignment_id: 1 }; // no group_id
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([
              { assignment_id: 1, due_date: null, is_group: false },
            ])
            .mockResolvedValueOnce([{ group_id: 5 }]) // existing solo group
            .mockResolvedValueOnce([{ group_id: 5 }]) // membership ok
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
              { submission_id: 2, submitted_at: new Date() },
            ]),
        };
        return cb(manager);
      });

      const result = await service.createSubmission(1, individualDto);
      expect(result.success).toBe(true);
      expect(result.data.group_id).toBe(5);
    });
  });

  // ─── updateSubmission ─────────────────────────────────────────────────────

  describe('updateSubmission', () => {
    const dto = { submission_id: 1, assignment_id: 1, group_id: 10 };

    it('should throw BadRequestException if assignment not found', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = { query: jest.fn().mockResolvedValueOnce([]) };
        return cb(manager);
      });
      await expect(service.updateSubmission(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if past due date', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest.fn().mockResolvedValueOnce([
            {
              assignment_id: 1,
              due_date: new Date(Date.now() - 86400000),
              is_group: true,
            },
          ]),
        };
        return cb(manager);
      });
      await expect(service.updateSubmission(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user not a member', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([
              { assignment_id: 1, due_date: null, is_group: true },
            ])
            .mockResolvedValueOnce([]), // not member
        };
        return cb(manager);
      });
      await expect(service.updateSubmission(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if submission not found', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([
              { assignment_id: 1, due_date: null, is_group: true },
            ])
            .mockResolvedValueOnce([{ group_id: 10 }])
            .mockResolvedValueOnce([]), // not found
        };
        return cb(manager);
      });
      await expect(service.updateSubmission(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update submission successfully', async () => {
      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([
              { assignment_id: 1, due_date: null, is_group: true },
            ])
            .mockResolvedValueOnce([{ group_id: 10 }])
            .mockResolvedValueOnce([{ submission_id: 1 }])
            .mockResolvedValueOnce([]) // delete old attachments
            .mockResolvedValueOnce([{ submitted_at: new Date() }]),
        };
        return cb(manager);
      });

      const result = await service.updateSubmission(1, dto);
      expect(result.success).toBe(true);
      expect(result.data.submission_id).toBe(1);
    });
  });

  // ─── gradeSubmission ──────────────────────────────────────────────────────

  describe('gradeSubmission', () => {
    const mockSubmissionRow = {
      submission_id: 1,
      assignment_id: 5,
      group_id: 10,
      max_score: 100,
      is_group: true, // group assignment — ข้าม deleted-user guard
    };

    it('should throw BadRequestException if neither score nor feedback provided', async () => {
      await expect(
        service.gradeSubmission(1, { submission_id: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if submission not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(
        service.gradeSubmission(1, { submission_id: 99, score: 80 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if score exceeds max_score', async () => {
      mockQuery.mockResolvedValueOnce([mockSubmissionRow]);
      await expect(
        service.gradeSubmission(1, { submission_id: 1, score: 150 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if score is negative', async () => {
      mockQuery.mockResolvedValueOnce([mockSubmissionRow]);
      await expect(
        service.gradeSubmission(1, { submission_id: 1, score: -5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should grade successfully with score only', async () => {
      mockQuery
        .mockResolvedValueOnce([mockSubmissionRow])
        .mockResolvedValueOnce([
          {
            submission_id: 1,
            score: 85,
            feedback: null,
            marked_at: new Date(),
          },
        ]);

      const result = await service.gradeSubmission(1, {
        submission_id: 1,
        score: 85,
      });
      expect(result.success).toBe(true);
      expect(result.data.score).toBe(85);
      expect(result.data.max_score).toBe(100);
    });

    it('should throw BadRequestException when score is missing even if feedback is provided', async () => {
      await expect(
        service.gradeSubmission(1, {
          submission_id: 1,
          feedback: 'Good work!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should grade successfully with both score and feedback', async () => {
      mockQuery
        .mockResolvedValueOnce([mockSubmissionRow])
        .mockResolvedValueOnce([
          {
            submission_id: 1,
            score: 90,
            feedback: 'Excellent!',
            marked_at: new Date(),
          },
        ]);

      const result = await service.gradeSubmission(1, {
        submission_id: 1,
        score: 90,
        feedback: 'Excellent!',
      });
      expect(result.success).toBe(true);
      expect(result.data.score).toBe(90);
      expect(result.data.feedback).toBe('Excellent!');
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(
        service.gradeSubmission(1, { submission_id: 1, score: 80 }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw BadRequestException when grading individual assignment with deleted user', async () => {
      const individualRow = { ...mockSubmissionRow, is_group: false };
      mockQuery
        .mockResolvedValueOnce([individualRow]) // submission found
        .mockResolvedValueOnce([{ 1: 1 }]); // deletedCheck — deleted member exists

      await expect(
        service.gradeSubmission(1, { submission_id: 1, score: 80 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should grade successfully for individual assignment when user is NOT deleted', async () => {
      const individualRow = { ...mockSubmissionRow, is_group: false };
      mockQuery
        .mockResolvedValueOnce([individualRow]) // submission found
        .mockResolvedValueOnce([]) // deletedCheck — no deleted members
        .mockResolvedValueOnce([
          { submission_id: 1, score: 70, feedback: null, marked_at: new Date() },
        ]); // update result

      const result = await service.gradeSubmission(1, {
        submission_id: 1,
        score: 70,
      });
      expect(result.success).toBe(true);
      expect(result.data.score).toBe(70);
    });
  });

  // ─── getGroup (deleted-user pattern) ─────────────────────────────────────

  describe('getGroup — deleted user handling', () => {
    it('should include is_deleted=true member when user_sys_id is null', async () => {
      const mockGroup = {
        group_id: 1,
        group_name: 'Group A',
        members: [
          {
            user_sys_id: 8,
            first_name: 'กิตติกร',
            last_name: 'พิมเทศ',
            profile_pic: null,
            name: 'กิตติกร พิมเทศ',
            is_deleted: false,
          },
          {
            user_sys_id: 99,
            first_name: null,
            last_name: null,
            profile_pic: null,
            name: 'ไม่มีบัญชีผู้ใช้งาน',
            is_deleted: true,
          },
        ],
      };
      mockQuery.mockResolvedValueOnce([mockGroup]);

      const result = await service.getGroup(8, 1);
      expect(result.success).toBe(true);
      const deleted = result.data.members.find((m: any) => m.is_deleted);
      expect(deleted).toBeDefined();
      expect(deleted.name).toBe('ไม่มีบัญชีผู้ใช้งาน');
    });

    it('should still return group even if all members are deleted', async () => {
      const mockGroup = {
        group_id: 2,
        group_name: 'Ghost Group',
        members: [
          { user_sys_id: 42, name: 'ไม่มีบัญชีผู้ใช้งาน', is_deleted: true, profile_pic: null },
        ],
      };
      mockQuery.mockResolvedValueOnce([mockGroup]);

      const result = await service.getGroup(42, 1);
      expect(result.success).toBe(true);
      expect(result.data.members).toHaveLength(1);
    });
  });

  // ─── getAllGroups (deleted-user pattern) ──────────────────────────────────

  describe('getAllGroups — deleted user handling', () => {
    it('should include is_deleted flag in member objects', async () => {
      const mockGroups = [
        {
          group_id: 1,
          group_name: 'G1',
          members: [
            { user_sys_id: 8, name: 'กิตติกร พิมเทศ', is_deleted: false, profile_pic: null },
            { user_sys_id: 55, name: 'ไม่มีบัญชีผู้ใช้งาน', is_deleted: true, profile_pic: null },
          ],
        },
      ];
      mockQuery.mockResolvedValueOnce(mockGroups);

      const result = await service.getAllGroups(1);
      expect(result.success).toBe(true);
      const group = result.data[0];
      expect(group.members.some((m: any) => m.is_deleted)).toBe(true);
      expect(group.members.find((m: any) => m.is_deleted).name).toBe(
        'ไม่มีบัญชีผู้ใช้งาน',
      );
    });
  });

  // ─── updateGroup (existing deleted members allowed) ───────────────────────

  describe('updateGroup — deleted member handling', () => {
    it('should allow keeping existing deleted member without validation error', async () => {
      // member_ids: [1, 2] — member 2 ถูกลบไปแล้วแต่ยังอยู่ใน group เดิม
      const dto = {
        assignment_id: 1,
        group_id: 10,
        group_name: 'Updated Group',
        member_ids: [1, 2],
      };

      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ group_id: 10 }]) // group exists
            .mockResolvedValueOnce([{ user_sys_id: 1 }, { user_sys_id: 2 }]) // currentGroupMembers — both already in group
            // no validation query since newMemberIds is empty
            .mockResolvedValueOnce([]) // update group name
            .mockResolvedValueOnce([]) // delete old members
            .mockResolvedValueOnce([]), // insert new members
        };
        return cb(manager);
      });

      const result = await service.updateGroup(1, dto);
      expect(result.success).toBe(true);
      expect(result.data.group_name).toBe('Updated Group');
    });

    it('should validate only newly added members, not existing ones', async () => {
      // member_ids: [1, 2, 3] — member 3 is new and valid
      const dto = {
        assignment_id: 1,
        group_id: 10,
        group_name: 'Updated Group',
        member_ids: [1, 2, 3],
      };

      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ group_id: 10 }]) // group exists
            .mockResolvedValueOnce([{ user_sys_id: 1 }, { user_sys_id: 2 }]) // currentGroupMembers
            .mockResolvedValueOnce([{ user_sys_id: 3 }]) // validNewMembers — member 3 is active
            .mockResolvedValueOnce([]) // update group name
            .mockResolvedValueOnce([]) // delete old members
            .mockResolvedValueOnce([]), // insert new members
        };
        return cb(manager);
      });

      const result = await service.updateGroup(1, dto);
      expect(result.success).toBe(true);
      expect(result.data.members).toHaveLength(3);
    });

    it('should throw BadRequestException when new member is inactive or not enrolled', async () => {
      const dto = {
        assignment_id: 1,
        group_id: 10,
        group_name: 'Updated Group',
        member_ids: [1, 99], // 99 is new but inactive/not enrolled
      };

      mockTransaction.mockImplementationOnce(async (cb) => {
        const manager = {
          query: jest
            .fn()
            .mockResolvedValueOnce([{ group_id: 10 }]) // group exists
            .mockResolvedValueOnce([{ user_sys_id: 1 }]) // currentGroupMembers — only 1 exists
            .mockResolvedValueOnce([]), // validNewMembers — 99 is invalid (empty result)
        };
        return cb(manager);
      });

      await expect(service.updateGroup(1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── getStudentsSubmissionStatus ──────────────────────────────────────────

  describe('getStudentsSubmissionStatus', () => {
    const mockAssignmentRow = [{ assignment_id: 1, section_id: 2 }];

    it('should return success=false if assignment not found', async () => {
      mockQuery.mockResolvedValueOnce([]); // assignment not found

      const result = await service.getStudentsSubmissionStatus(999);
      expect(result.success).toBe(false);
    });

    it('should return students with submission status', async () => {
      const studentRow = {
        user_sys_id: 8,
        first_name: 'กิตติกร',
        last_name: 'พิมเทศ',
        profile_pic: null,
        code: '202600',
        is_deleted: false,
        submission_id: 1,
        submitted_at: new Date(),
        score: null,
        feedback: null,
        marked_at: null,
        group_id: 10,
        group_name: 'individual_student_8',
        submission_status: 'submitted',
      };

      mockQuery
        .mockResolvedValueOnce(mockAssignmentRow)
        .mockResolvedValueOnce([studentRow]);

      const result = await service.getStudentsSubmissionStatus(1);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].user_sys_id).toBe(8);
      expect(result.data[0].submission_status).toBe('submitted');
      expect(result.data[0].first_name).toBe('กิตติกร');
      expect(result.data[0].last_name).toBe('พิมเทศ');
    });

    it('should show deleted pattern when user_sys_id is null (user removed)', async () => {
      const deletedRow = {
        user_sys_id: null,
        first_name: '',
        last_name: '',
        profile_pic: null,
        code: null,
        submission_id: 12,
        submitted_at: new Date(),
        score: null,
        feedback: null,
        marked_at: null,
        group_id: 10,
        group_name: 'Group Deleted',
        submission_status: 'submitted',
      };

      mockQuery
        .mockResolvedValueOnce(mockAssignmentRow)
        .mockResolvedValueOnce([deletedRow]);

      const result = await service.getStudentsSubmissionStatus(1);
      expect(result.data[0].user_sys_id).toBeNull();
      expect(result.data[0].first_name).toBe('');
      expect(result.data[0].last_name).toBe('');
      expect(result.data[0].profile_pic).toBeNull();
      expect(result.data[0].submission_status).toBe('submitted');
      expect(result.data[0].group_name).toBe('Group Deleted');
    });

    it('should not include Inactive users (Inactive filtered at SQL level)', async () => {
      // ยืนยัน query ไม่มีเงื่อนไข user_status = Active ที่เปิดให้ Inactive ผ่าน
      // ตรวจ query string ว่า filter ถูก
      mockQuery
        .mockResolvedValueOnce(mockAssignmentRow)
        .mockResolvedValueOnce([]);

      await service.getStudentsSubmissionStatus(1);

      const studentQuery: string = mockQuery.mock.calls[1][0];
      // ต้องมี filter ที่กัน Inactive: LEFT JOIN + OR condition
      expect(studentQuery).toContain('user_status');
    });

    it('should return empty data array when no students', async () => {
      mockQuery
        .mockResolvedValueOnce(mockAssignmentRow)
        .mockResolvedValueOnce([]);

      const result = await service.getStudentsSubmissionStatus(1);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getStudentsSubmissionStatus(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── getSubmissionDetailForTeacher ────────────────────────────────────────

  describe('getSubmissionDetailForTeacher', () => {
    const mockSubmission = {
      submission_id: 1,
      assignment_id: 5,
      submitted_at: new Date(),
      score: null,
      feedback: null,
      marked_at: null,
      group_id: 10,
      group_name: 'Group A',
      max_score: 100,
      due_date: new Date(),
      is_group: true,
    };

    it('should return success=false if submission not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await service.getSubmissionDetailForTeacher(999);
      expect(result.success).toBe(false);
    });

    it('should return submission detail with can_grade=true for group assignment', async () => {
      const members = [
        { user_sys_id: 8, first_name: 'กิตติกร', last_name: 'พิมเทศ', profile_pic: null, display_name: 'กิตติกร พิมเทศ', is_deleted: false },
      ];

      mockQuery
        .mockResolvedValueOnce([mockSubmission]) // submission
        .mockResolvedValueOnce([]) // attachments
        .mockResolvedValueOnce(members); // members

      const result = await service.getSubmissionDetailForTeacher(1);
      expect(result.success).toBe(true);
      expect(result.data!.can_grade).toBe(true);
      expect(result.data!.grade_disabled_reason).toBeNull();
      expect(result.data!.members).toHaveLength(1);
    });

    it('should return can_grade=false for individual assignment with deleted user', async () => {
      const individualSubmission = { ...mockSubmission, is_group: false };
      const members = [
        { user_sys_id: 42, first_name: null, last_name: null, profile_pic: null, display_name: 'ไม่มีบัญชีผู้ใช้งาน', is_deleted: true },
      ];

      mockQuery
        .mockResolvedValueOnce([individualSubmission])
        .mockResolvedValueOnce([]) // attachments
        .mockResolvedValueOnce(members); // deleted member

      const result = await service.getSubmissionDetailForTeacher(1);
      expect(result.data!.can_grade).toBe(false);
      expect(result.data!.grade_disabled_reason).toBe(
        'ไม่มีบัญชีผู้ใช้งาน ไม่สามารถให้คะแนนและข้อแนะนำได้',
      );
    });

    it('should return can_grade=true for group assignment even if one member is deleted', async () => {
      // งานกลุ่ม: ถึงแม้มี deleted member ก็ยังให้คะแนนได้
      const members = [
        { user_sys_id: 8, display_name: 'กิตติกร พิมเทศ', is_deleted: false, profile_pic: null },
        { user_sys_id: 99, display_name: 'ไม่มีบัญชีผู้ใช้งาน', is_deleted: true, profile_pic: null },
      ];

      mockQuery
        .mockResolvedValueOnce([mockSubmission]) // is_group: true
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(members);

      const result = await service.getSubmissionDetailForTeacher(1);
      expect(result.data!.can_grade).toBe(true);
    });

    it('should include attachments in response', async () => {
      const mockAttachments = [
        { attachment_id: 1, file_url: 'f.pdf', original_name: 'f.pdf', file_type: 'pdf' },
      ];
      const members = [
        { user_sys_id: 8, display_name: 'กิตติกร', is_deleted: false, profile_pic: null },
      ];

      mockQuery
        .mockResolvedValueOnce([mockSubmission])
        .mockResolvedValueOnce(mockAttachments)
        .mockResolvedValueOnce(members);

      const result = await service.getSubmissionDetailForTeacher(1);
      expect(result.data!.attachments).toHaveLength(1);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB error'));
      await expect(service.getSubmissionDetailForTeacher(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
