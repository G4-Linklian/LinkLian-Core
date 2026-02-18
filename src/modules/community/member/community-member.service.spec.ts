import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CommunityMemberService } from './community-member.service';

describe('CommunityMemberService', () => {
  let service: CommunityMemberService;
  let dataSource: DataSource;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      query: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityMemberService,
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommunityMemberService>(CommunityMemberService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('joinCommunity', () => {
    it('should successfully join a public community', async () => {
      const userId = 1;
      const communityId = 1;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: false },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { community_id: 1, user_sys_id: 1, status: 'active' },
        ]);

      const result = await service.joinCommunity(userId, communityId);

      expect(result).toEqual([
        { community_id: 1, user_sys_id: 1, status: 'active' },
      ]);
      expect(dataSource.query).toHaveBeenCalledTimes(3);
    });

    it('should join private community with pending status', async () => {
      const userId = 1;
      const communityId = 1;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: true },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { community_id: 1, user_sys_id: 1, status: 'pending' },
        ]);

      const result = await service.joinCommunity(userId, communityId);

      expect(result).toEqual([
        { community_id: 1, user_sys_id: 1, status: 'pending' },
      ]);
    });

    it('should throw error when community not found', async () => {
      const userId = 1;
      const communityId = 999;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        service.joinCommunity(userId, communityId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when community is inactive', async () => {
      const userId = 1;
      const communityId = 1;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { status: 'inactive', is_private: false },
      ]);

      await expect(
        service.joinCommunity(userId, communityId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw error when already joined', async () => {
      const userId = 1;
      const communityId = 1;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: false },
        ])
        .mockResolvedValueOnce([
          { flag_valid: true, status: 'active' },
        ]);

      await expect(
        service.joinCommunity(userId, communityId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update existing member if previously left', async () => {
      const userId = 1;
      const communityId = 1;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: false },
        ])
        .mockResolvedValueOnce([
          { flag_valid: false, status: 'inactive' },
        ])
        .mockResolvedValueOnce([
          { community_id: 1, user_sys_id: 1, status: 'active' },
        ]);

      const result = await service.joinCommunity(userId, communityId);

      expect(result).toEqual([
        { community_id: 1, user_sys_id: 1, status: 'active' },
      ]);
    });
  });

  describe('approveMember', () => {
    it('should approve pending member', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 2;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ status: 'pending' }])
        .mockResolvedValueOnce([
          { community_id: 1, user_sys_id: 2, status: 'active' },
        ]);

      const result = await service.approveMember(
        ownerId,
        communityId,
        targetUserId,
      );

      expect(result).toEqual([
        { community_id: 1, user_sys_id: 2, status: 'active' },
      ]);
    });

    it('should throw error when community not found', async () => {
      const ownerId = 1;
      const communityId = 999;
      const targetUserId = 2;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        service.approveMember(ownerId, communityId, targetUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when community is inactive', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 2;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { status: 'inactive' },
      ]);

      await expect(
        service.approveMember(ownerId, communityId, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw error when user is not owner', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 2;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([]);

      await expect(
        service.approveMember(ownerId, communityId, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw error when target user not found', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 999;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([]);

      await expect(
        service.approveMember(ownerId, communityId, targetUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when user already approved', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 2;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ status: 'active' }]);

      await expect(
        service.approveMember(ownerId, communityId, targetUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('leaveCommunity', () => {
    it('should successfully leave community', async () => {
      const userId = 1;
      const communityId = 1;

      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(
        mockQueryRunner,
      );
      mockQueryRunner.query
        .mockResolvedValueOnce([{ role: 'member', flag_valid: true }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.leaveCommunity(userId, communityId);

      expect(result).toEqual({ message: 'Left community successfully' });
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should deactivate community when owner leaves', async () => {
      const userId = 1;
      const communityId = 1;

      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(
        mockQueryRunner,
      );
      mockQueryRunner.query
        .mockResolvedValueOnce([
          { role: 'owner', flag_valid: true, status: 'active' },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.leaveCommunity(userId, communityId);

      expect(result).toEqual({ message: 'Left community successfully' });
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE community'),
        [communityId],
      );
    });

    it('should throw error when not a member', async () => {
      const userId = 999;
      const communityId = 1;

      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(
        mockQueryRunner,
      );
      mockQueryRunner.query.mockResolvedValueOnce([]);

      await expect(
        service.leaveCommunity(userId, communityId),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw error when already left', async () => {
      const userId = 1;
      const communityId = 1;

      (dataSource.createQueryRunner as jest.Mock).mockReturnValue(
        mockQueryRunner,
      );
      mockQueryRunner.query.mockResolvedValueOnce([
        { role: 'member', flag_valid: false },
      ]);

      await expect(
        service.leaveCommunity(userId, communityId),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('getMembers', () => {
    it('should return all active members', async () => {
      const communityId = 1;
      const expectedMembers = [
        {
          user_sys_id: 1,
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic1.jpg',
        },
        {
          user_sys_id: 2,
          first_name: 'Jane',
          last_name: 'Smith',
          profile_pic: 'pic2.jpg',
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(expectedMembers);

      const result = await service.getMembers(communityId);

      expect(result).toEqual(expectedMembers);
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT u.user_sys_id'),
        [communityId],
      );
    });

    it('should return empty array when no members', async () => {
      const communityId = 1;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      const result = await service.getMembers(communityId);

      expect(result).toEqual([]);
    });
  });

  describe('getPendingMembers', () => {
    it('should return pending and active members for owner', async () => {
      const ownerId = 1;
      const communityId = 1;
      const expectedMembers = [
        {
          user_sys_id: 2,
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic1.jpg',
          status: 'pending',
        },
        {
          user_sys_id: 3,
          first_name: 'Jane',
          last_name: 'Smith',
          profile_pic: 'pic2.jpg',
          status: 'active',
        },
      ];

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce(expectedMembers);

      const result = await service.getPendingMembers(ownerId, communityId);

      expect(result).toEqual(expectedMembers);
    });

    it('should throw error when user is not owner', async () => {
      const ownerId = 1;
      const communityId = 1;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        service.getPendingMembers(ownerId, communityId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectMember', () => {
    it('should reject pending member', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 2;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ status: 'pending' }])
        .mockResolvedValueOnce([]);

      const result = await service.rejectMember(
        ownerId,
        communityId,
        targetUserId,
      );

      expect(result).toEqual({ message: 'Rejected successfully' });
    });

    it('should reject active member', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 2;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([]);

      const result = await service.rejectMember(
        ownerId,
        communityId,
        targetUserId,
      );

      expect(result).toEqual({ message: 'Rejected successfully' });
    });

    it('should throw error when user is not owner', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 2;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        service.rejectMember(ownerId, communityId, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw error when target user not found', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 999;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([]);

      await expect(
        service.rejectMember(ownerId, communityId, targetUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when member has invalid status', async () => {
      const ownerId = 1;
      const communityId = 1;
      const targetUserId = 2;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([{ role: 'owner' }])
        .mockResolvedValueOnce([{ status: 'inactive' }]);

      await expect(
        service.rejectMember(ownerId, communityId, targetUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
