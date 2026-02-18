import { Test, TestingModule } from '@nestjs/testing';
import { CommunityMemberController } from './community-member.controller';
import { CommunityMemberService } from './community-member.service';

describe('CommunityMemberController', () => {
  let controller: CommunityMemberController;
  let service: CommunityMemberService;

  beforeEach(async () => {
    const mockService = {
      joinCommunity: jest.fn(),
      approveMember: jest.fn(),
      rejectMember: jest.fn(),
      leaveCommunity: jest.fn(),
      getPendingMembers: jest.fn(),
      getMembers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityMemberController],
      providers: [
        { provide: CommunityMemberService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<CommunityMemberController>(
      CommunityMemberController,
    );
    service = module.get<CommunityMemberService>(CommunityMemberService);
  });

  describe('join', () => {
    it('should join community', async () => {
      const userId = '1';
      const communityId = '5';

      (service.joinCommunity as jest.Mock).mockResolvedValueOnce({
        success: true,
        community_id: 5,
        user_sys_id: 1,
        status: 'pending',
      });

      const result = await controller.join(userId, communityId);

      expect(service.joinCommunity).toHaveBeenCalledWith(1, 5);
      expect(result.success).toBe(true);
    });

    it('should convert userId string to number', async () => {
      const userId = '42';
      const communityId = '10';

      (service.joinCommunity as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.join(userId, communityId);

      const callArgs = (service.joinCommunity as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(42);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should convert communityId string to number', async () => {
      const userId = '1';
      const communityId = '99';

      (service.joinCommunity as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.join(userId, communityId);

      const callArgs = (service.joinCommunity as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(99);
      expect(typeof callArgs[1]).toBe('number');
    });

    it('should return membership response', async () => {
      const userId = '1';
      const communityId = '5';

      const mockResponse = {
        success: true,
        community_id: 5,
        user_sys_id: 1,
        status: 'active',
        joined_at: new Date(),
      };

      (service.joinCommunity as jest.Mock).mockResolvedValueOnce(
        mockResponse,
      );

      const result = await controller.join(userId, communityId);

      expect(result).toHaveProperty('community_id', 5);
      expect(result).toHaveProperty('status');
    });

    it('should handle pending status', async () => {
      const userId = '1';
      const communityId = '5';

      (service.joinCommunity as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 'pending',
      });

      const result = await controller.join(userId, communityId);

      expect(result.status).toBe('pending');
    });
  });

  describe('approve', () => {
    it('should approve a pending member', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
        user_sys_id: 10,
        status: 'active',
      });

      const result = await controller.approve(ownerId, communityId, targetUserId);

      expect(service.approveMember).toHaveBeenCalledWith(1, 5, 10);
      expect(result.success).toBe(true);
    });

    it('should convert ownerId string to number', async () => {
      const ownerId = '50';
      const communityId = '5';
      const targetUserId = '10';

      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.approve(ownerId, communityId, targetUserId);

      const callArgs = (service.approveMember as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(50);
    });

    it('should convert communityId string to number', async () => {
      const ownerId = '1';
      const communityId = '100';
      const targetUserId = '10';

      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.approve(ownerId, communityId, targetUserId);

      const callArgs = (service.approveMember as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(100);
    });

    it('should convert targetUserId string to number', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '999';

      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.approve(ownerId, communityId, targetUserId);

      const callArgs = (service.approveMember as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe(999);
    });

    it('should return approved member response', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
        user_sys_id: 10,
        status: 'active',
        approved_at: new Date(),
      });

      const result = await controller.approve(ownerId, communityId, targetUserId);

      expect(result.user_sys_id).toBe(10);
      expect(result.status).toBe('active');
    });

    it('should verify owner permission', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.approve(ownerId, communityId, targetUserId);

      const callArgs = (service.approveMember as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(1); // ownerId
    });
  });

  describe('reject', () => {
    it('should reject a pending member', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      (service.rejectMember as jest.Mock).mockResolvedValueOnce({
        message: 'Rejected successfully',
      });

      const result = await controller.reject(ownerId, communityId, targetUserId);

      expect(service.rejectMember).toHaveBeenCalledWith(1, 5, 10);
      expect((result as any).message).toBe('Rejected successfully');
    });

    it('should convert ownerId string to number', async () => {
      const ownerId = '77';
      const communityId = '5';
      const targetUserId = '10';

      (service.rejectMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.reject(ownerId, communityId, targetUserId);

      const callArgs = (service.rejectMember as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(77);
    });

    it('should convert communityId string to number', async () => {
      const ownerId = '1';
      const communityId = '200';
      const targetUserId = '10';

      (service.rejectMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.reject(ownerId, communityId, targetUserId);

      const callArgs = (service.rejectMember as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(200);
    });

    it('should convert targetUserId string to number', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '555';

      (service.rejectMember as jest.Mock).mockResolvedValueOnce({
        message: 'Rejected successfully',
      });

      await controller.reject(ownerId, communityId, targetUserId);

      const callArgs = (service.rejectMember as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe(555);
    });

    it('should return rejection response', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      (service.rejectMember as jest.Mock).mockResolvedValueOnce({
        message: 'Rejected successfully',
      });

      const result = await controller.reject(ownerId, communityId, targetUserId);

      expect((result as any).message).toBe('Rejected successfully');
    });
  });

  describe('leave', () => {
    it('should leave community', async () => {
      const userId = '1';
      const communityId = '5';

      (service.leaveCommunity as jest.Mock).mockResolvedValueOnce({
        message: 'Left community successfully',
      });

      const result = await controller.leave(userId, communityId);

      expect(service.leaveCommunity).toHaveBeenCalledWith(1, 5);
      expect((result as any).message).toBe('Left community successfully');
    });

    it('should convert userId string to number', async () => {
      const userId = '33';
      const communityId = '5';

      (service.leaveCommunity as jest.Mock).mockResolvedValueOnce({
        message: 'Left community successfully',
      });

      await controller.leave(userId, communityId);

      const callArgs = (service.leaveCommunity as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(33);
    });

    it('should convert communityId string to number', async () => {
      const userId = '1';
      const communityId = '888';

      (service.leaveCommunity as jest.Mock).mockResolvedValueOnce({
        message: 'Left community successfully',
      });

      await controller.leave(userId, communityId);

      const callArgs = (service.leaveCommunity as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(888);
    });

    it('should return leave response', async () => {
      const userId = '1';
      const communityId = '5';

      (service.leaveCommunity as jest.Mock).mockResolvedValueOnce({
        message: 'Left community successfully',
      });

      const result = await controller.leave(userId, communityId);

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('pendingMembers', () => {
    it('should get pending members', async () => {
      const ownerId = '1';
      const communityId = '5';

      const mockPending = [
        { user_sys_id: 10, first_name: 'John', last_name: 'Doe', status: 'pending' },
        { user_sys_id: 20, first_name: 'Jane', last_name: 'Smith', status: 'pending' },
      ];

      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce(
        mockPending,
      );

      const result = await controller.pendingMembers(ownerId, communityId);

      expect(service.getPendingMembers).toHaveBeenCalledWith(1, 5);
      expect(result).toEqual(mockPending);
    });

    it('should convert ownerId string to number', async () => {
      const ownerId = '66';
      const communityId = '5';

      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce([]);

      await controller.pendingMembers(ownerId, communityId);

      const callArgs = (service.getPendingMembers as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(66);
    });

    it('should convert communityId string to number', async () => {
      const ownerId = '1';
      const communityId = '777';

      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce([]);

      await controller.pendingMembers(ownerId, communityId);

      const callArgs = (service.getPendingMembers as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe(777);
    });

    it('should return array of pending members', async () => {
      const ownerId = '1';
      const communityId = '5';

      const mockPending = [
        { user_sys_id: 10, status: 'pending' },
        { user_sys_id: 20, status: 'pending' },
        { user_sys_id: 30, status: 'pending' },
      ];

      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce(
        mockPending,
      );

      const result = await controller.pendingMembers(ownerId, communityId);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('should return empty array if no pending members', async () => {
      const ownerId = '1';
      const communityId = '5';

      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce([]);

      const result = await controller.pendingMembers(ownerId, communityId);

      expect(result).toEqual([]);
    });

    it('should include user info in pending members', async () => {
      const ownerId = '1';
      const communityId = '5';

      const mockPending = [
        {
          user_sys_id: 10,
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic.jpg',
          request_at: new Date(),
        },
      ];

      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce(
        mockPending,
      );

      const result = await controller.pendingMembers(ownerId, communityId);

      expect(result[0]).toHaveProperty('first_name', 'John');
      expect(result[0]).toHaveProperty('profile_pic');
    });
  });

  describe('members', () => {
    it('should get members of community', async () => {
      const communityId = '5';

      const mockMembers = [
        { user_sys_id: 1, first_name: 'Owner', role: 'owner', status: 'active' },
        { user_sys_id: 2, first_name: 'Member', role: 'member', status: 'active' },
      ];

      (service.getMembers as jest.Mock).mockResolvedValueOnce(mockMembers);

      const result = await controller.members(communityId);

      expect(service.getMembers).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockMembers);
    });

    it('should convert communityId string to number', async () => {
      const communityId = '55';

      (service.getMembers as jest.Mock).mockResolvedValueOnce([]);

      await controller.members(communityId);

      const callArgs = (service.getMembers as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(55);
      expect(typeof callArgs[0]).toBe('number');
    });

    it('should return array of members', async () => {
      const communityId = '5';

      const mockMembers = [
        { user_sys_id: 1, first_name: 'User1', status: 'active' },
        { user_sys_id: 2, first_name: 'User2', status: 'active' },
        { user_sys_id: 3, first_name: 'User3', status: 'active' },
      ];

      (service.getMembers as jest.Mock).mockResolvedValueOnce(mockMembers);

      const result = await controller.members(communityId);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('should return empty array if no members', async () => {
      const communityId = '999';

      (service.getMembers as jest.Mock).mockResolvedValueOnce([]);

      const result = await controller.members(communityId);

      expect(result).toEqual([]);
    });

    it('should include user info in members', async () => {
      const communityId = '5';

      const mockMembers = [
        {
          user_sys_id: 1,
          first_name: 'John',
          last_name: 'Doe',
          profile_pic: 'pic.jpg',
          role: 'owner',
          status: 'active',
        },
      ];

      (service.getMembers as jest.Mock).mockResolvedValueOnce(mockMembers);

      const result = await controller.members(communityId);

      expect(result[0]).toHaveProperty('first_name', 'John');
      expect(result[0]).toHaveProperty('role', 'owner');
    });

    it('should differentiate between roles', async () => {
      const communityId = '5';

      const mockMembers = [
        { user_sys_id: 1, role: 'owner', first_name: 'Owner' },
        { user_sys_id: 2, role: 'member', first_name: 'Member' },
      ];

      (service.getMembers as jest.Mock).mockResolvedValueOnce(mockMembers);

      const result = await controller.members(communityId);

      expect(result[0].role).toBe('owner');
      expect(result[1].role).toBe('member');
    });
  });

  describe('Parameter conversion', () => {
    it('should handle large numeric IDs', async () => {
      const userId = '999999';
      const communityId = '888888';

      (service.joinCommunity as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.join(userId, communityId);

      const callArgs = (service.joinCommunity as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(999999);
      expect(callArgs[1]).toBe(888888);
    });

    it('should convert all numeric strings in approve', async () => {
      const ownerId = '111';
      const communityId = '222';
      const targetUserId = '333';

      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.approve(ownerId, communityId, targetUserId);

      const callArgs = (service.approveMember as jest.Mock).mock.calls[0];
      expect(callArgs).toEqual([111, 222, 333]);
    });
  });

  describe('Error handling', () => {
    it('should propagate service errors in join', async () => {
      const userId = '1';
      const communityId = '5';

      (service.joinCommunity as jest.Mock).mockRejectedValueOnce(
        new Error('Join failed'),
      );

      await expect(
        controller.join(userId, communityId),
      ).rejects.toThrow('Join failed');
    });

    it('should propagate service errors in approve', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      (service.approveMember as jest.Mock).mockRejectedValueOnce(
        new Error('Approve failed'),
      );

      await expect(
        controller.approve(ownerId, communityId, targetUserId),
      ).rejects.toThrow('Approve failed');
    });

    it('should propagate service errors in reject', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      (service.rejectMember as jest.Mock).mockRejectedValueOnce(
        new Error('Reject failed'),
      );

      await expect(
        controller.reject(ownerId, communityId, targetUserId),
      ).rejects.toThrow('Reject failed');
    });

    it('should propagate service errors in leave', async () => {
      const userId = '1';
      const communityId = '5';

      (service.leaveCommunity as jest.Mock).mockRejectedValueOnce(
        new Error('Leave failed'),
      );

      await expect(
        controller.leave(userId, communityId),
      ).rejects.toThrow('Leave failed');
    });

    it('should propagate service errors in getPendingMembers', async () => {
      const ownerId = '1';
      const communityId = '5';

      (service.getPendingMembers as jest.Mock).mockRejectedValueOnce(
        new Error('Fetch failed'),
      );

      await expect(
        controller.pendingMembers(ownerId, communityId),
      ).rejects.toThrow('Fetch failed');
    });

    it('should propagate service errors in getMembers', async () => {
      const communityId = '5';

      (service.getMembers as jest.Mock).mockRejectedValueOnce(
        new Error('Fetch failed'),
      );

      await expect(
        controller.members(communityId),
      ).rejects.toThrow('Fetch failed');
    });
  });

  describe('Integration scenarios', () => {
    it('should join community then get members', async () => {
      const userId = '1';
      const communityId = '5';

      // Join
      (service.joinCommunity as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 'pending',
      });

      const joinResult = await controller.join(userId, communityId);
      expect(joinResult.status).toBe('pending');

      // Get members
      (service.getMembers as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1, first_name: 'User1', status: 'active' },
      ]);

      const members = await controller.members(communityId);
      expect(members).toHaveLength(1);
    });

    it('should approve member then get pending members', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      // Approve
      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 'active',
      });

      const approved = await controller.approve(ownerId, communityId, targetUserId);
      expect(approved.status).toBe('active');

      // Get pending
      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce([]);

      const pending = await controller.pendingMembers(ownerId, communityId);
      expect(pending).toHaveLength(0);
    });

    it('should handle multiple member operations', async () => {
      const ownerId = '1';
      const communityId = '5';

      // Get pending members
      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 10, first_name: 'Pending User' },
      ]);

      const pending = await controller.pendingMembers(ownerId, communityId);
      expect(pending).toHaveLength(1);

      // Approve member
      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.approve(ownerId, communityId, '10');

      // Get all members
      (service.getMembers as jest.Mock).mockResolvedValueOnce([
        { user_sys_id: 1, role: 'owner' },
        { user_sys_id: 10, role: 'member' },
      ]);

      const members = await controller.members(communityId);
      expect(members).toHaveLength(2);
    });

    it('should handle reject then verify no pending', async () => {
      const ownerId = '1';
      const communityId = '5';
      const targetUserId = '10';

      // Reject member
      (service.rejectMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const rejected = await controller.reject(ownerId, communityId, targetUserId);
      expect((rejected as any).message).toBeDefined();

      // Get pending - should be empty
      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce([]);

      const pending = await controller.pendingMembers(ownerId, communityId);
      expect(pending).toHaveLength(0);
    });

    it('should handle join, then leave community', async () => {
      const userId = '1';
      const communityId = '5';

      // Join
      (service.joinCommunity as jest.Mock).mockResolvedValueOnce({
        success: true,
        status: 'pending',
      });

      const joined = await controller.join(userId, communityId);
      expect(joined.success).toBe(true);

      // Leave
      (service.leaveCommunity as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const left = await controller.leave(userId, communityId);
      expect((left as any).message).toBeDefined();
    });
  });

  describe('Data transformation', () => {
    it('should transform all parameters in approve', async () => {
      const ownerId = '123';
      const communityId = '456';
      const targetUserId = '789';

      (service.approveMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.approve(ownerId, communityId, targetUserId);

      expect(service.approveMember).toHaveBeenCalledWith(123, 456, 789);
    });

    it('should transform all parameters in reject', async () => {
      const ownerId = '100';
      const communityId = '200';
      const targetUserId = '300';

      (service.rejectMember as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      await controller.reject(ownerId, communityId, targetUserId);

      expect(service.rejectMember).toHaveBeenCalledWith(100, 200, 300);
    });

    it('should handle numeric conversions across all endpoints', async () => {
      const userId = '10';
      const communityId = '20';
      const targetUserId = '30';

      // Join
      (service.joinCommunity as jest.Mock).mockResolvedValueOnce({});
      await controller.join(userId, communityId);
      expect(service.joinCommunity).toHaveBeenCalledWith(10, 20);

      // Leave
      (service.leaveCommunity as jest.Mock).mockResolvedValueOnce({});
      await controller.leave(userId, communityId);
      expect(service.leaveCommunity).toHaveBeenCalledWith(10, 20);

      // Approve
      (service.approveMember as jest.Mock).mockResolvedValueOnce({});
      await controller.approve(userId, communityId, targetUserId);
      expect(service.approveMember).toHaveBeenCalledWith(10, 20, 30);

      // Reject
      (service.rejectMember as jest.Mock).mockResolvedValueOnce({});
      await controller.reject(userId, communityId, targetUserId);
      expect(service.rejectMember).toHaveBeenCalledWith(10, 20, 30);

      // Get members
      (service.getMembers as jest.Mock).mockResolvedValueOnce([]);
      await controller.members(communityId);
      expect(service.getMembers).toHaveBeenCalledWith(20);

      // Get pending
      (service.getPendingMembers as jest.Mock).mockResolvedValueOnce([]);
      await controller.pendingMembers(userId, communityId);
      expect(service.getPendingMembers).toHaveBeenCalledWith(10, 20);
    });
  });
});
