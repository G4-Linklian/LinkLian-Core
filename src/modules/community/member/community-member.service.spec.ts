import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CommunityMemberService } from './community-member.service';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { BullMQService } from 'src/common/bullmq/bullmq.service';
import { JobType, NOTIFICATION_QUEUE } from 'src/worker/worker.constants';

const mockAddJob = jest.fn();

describe('CommunityMemberService', () => {
  let service: CommunityMemberService;
  let dataSource: any;
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
      query: jest.fn(),
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityMemberService,
        { provide: DataSource, useValue: dataSource },
        { provide: AppLogger, useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn() } },
        { provide: BullMQService, useValue: { addJob: mockAddJob } },
      ],
    }).compile();

    service = module.get(CommunityMemberService);
    mockAddJob.mockReset();
  });

  describe('joinCommunity', () => {
    it('should join public community', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active', is_private: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ community_id: 1 }]);

      const result = await service.joinCommunity(1, 1);

      expect(result.success).toBe(true);
    });

    it('should send request for private community', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active', is_private: true, name: 'Test' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ community_id: 1 }]);

      const result = await service.joinCommunity(1, 1);

      expect(result.message).toContain('Join request');
    });

    it('should enqueue COMMUNITY_MEMBER_JOINED notification for private community', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active', is_private: true, name: 'Dev Club' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ community_id: 1 }]);

      await service.joinCommunity(5, 1);

      expect(mockAddJob).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: NOTIFICATION_QUEUE,
          job: JobType.COMMUNITY_MEMBER_JOINED,
          data: expect.objectContaining({
            type: JobType.COMMUNITY_MEMBER_JOINED,
            actor_id: 5,
            community_id: 1,
            community_name: 'Dev Club',
          }),
        }),
      );
    });

    it('should NOT enqueue notification for public community', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active', is_private: false, name: 'Public' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ community_id: 1 }]);

      await service.joinCommunity(1, 1);

      expect(mockAddJob).not.toHaveBeenCalled();
    });

    it('should throw if community not found', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.joinCommunity(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if inactive', async () => {
      dataSource.query.mockResolvedValueOnce([
        { status: 'inactive', is_private: false },
      ]);

      await expect(service.joinCommunity(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if already active member', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active', is_private: false }])
        .mockResolvedValueOnce([
          { flag_valid: true, status: 'active' },
        ]);

      await expect(service.joinCommunity(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle internal error', async () => {
      dataSource.query.mockRejectedValue(new Error());

      await expect(service.joinCommunity(1, 1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('approveMember', () => {
    it('should approve pending member', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active', name: 'Club' }])
        .mockResolvedValueOnce([1])
        .mockResolvedValueOnce([{ status: 'pending' }])
        .mockResolvedValueOnce([[{ user_sys_id: 2 }]]);

      const result = await service.approveMember(1, 1, 2);

      expect(result.success).toBe(true);
    });

    it('should enqueue COMMUNITY_MEMBER_APPROVED notification after approval', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active', name: 'Science Club' }])
        .mockResolvedValueOnce([1])                      // owner check
        .mockResolvedValueOnce([{ status: 'pending' }])  // target status
        .mockResolvedValueOnce([[{ user_sys_id: 2 }]]);  // UPDATE result

      await service.approveMember(1, 1, 2);

      expect(mockAddJob).toHaveBeenCalledWith(
        expect.objectContaining({
          queue: NOTIFICATION_QUEUE,
          job: JobType.COMMUNITY_MEMBER_APPROVED,
          data: expect.objectContaining({
            type: JobType.COMMUNITY_MEMBER_APPROVED,
            target_user_id: 2,
            community_id: 1,
            community_name: 'Science Club',
            approver_id: 1,
          }),
        }),
      );
    });

    it('should throw if not owner', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([]);

      await expect(service.approveMember(1, 1, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('leaveCommunity', () => {
    it('should leave community', async () => {
      queryRunner.query
        .mockResolvedValueOnce([
          { role: 'member', flag_valid: true, status: 'active' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.leaveCommunity(1, 1);

      expect(result.success).toBe(true);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw if not member', async () => {
      queryRunner.query.mockResolvedValueOnce([]);

      await expect(service.leaveCommunity(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMembers', () => {
    it('should fetch members', async () => {
      dataSource.query.mockResolvedValue([{ user_sys_id: 1 }]);

      const result = await service.getMembers(1);

      expect(result.data.members).toHaveLength(1);
    });

    it('should throw internal error', async () => {
      dataSource.query.mockRejectedValue(new Error());

      await expect(service.getMembers(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getPendingMembers', () => {
    it('should fetch pending members', async () => {
      dataSource.query
        .mockResolvedValueOnce([1])
        .mockResolvedValueOnce([{ user_sys_id: 2 }]);

      const result = await service.getPendingMembers(1, 1);

      expect(result.success).toBe(true);
    });

    it('should throw if not owner', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.getPendingMembers(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('rejectMember', () => {
    it('should reject member', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([1])
        .mockResolvedValueOnce([{ status: 'pending' }])
        .mockResolvedValueOnce([]);

      const result = await service.rejectMember(1, 1, 2);

      expect(result.success).toBe(true);
    });

    it('should throw if community not found', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await expect(service.rejectMember(1, 1, 2)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});