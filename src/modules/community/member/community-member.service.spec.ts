import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CommunityMemberService } from './community-member.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

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
        { provide: AppLogger, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(CommunityMemberService);
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
        .mockResolvedValueOnce([{ status: 'active', is_private: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ community_id: 1 }]);

      const result = await service.joinCommunity(1, 1);

      expect(result.message).toContain('Join request');
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
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([1])
        .mockResolvedValueOnce([{ status: 'pending' }])
        .mockResolvedValueOnce([[{ user_sys_id: 2 }]]);

      const result = await service.approveMember(1, 1, 2);

      expect(result.success).toBe(true);
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