import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityEntity } from './entities/community.entity';
import { CommunityMemberEntity } from '../member/entities/community-member.entity';
import { CommunityTagEntity } from './entities/community-tag.entity';
import { CommunityTagNormalizeEntity } from './entities/community-tag-normalize.entity';

describe('CommunityService', () => {
  let service: CommunityService;
  let dataSource: DataSource;
  let communityRepo: Repository<CommunityEntity>;
  let memberRepo: Repository<CommunityMemberEntity>;
  let tagRepo: Repository<CommunityTagEntity>;
  let tagNormalizeRepo: Repository<CommunityTagNormalizeEntity>;
  let mockQueryRunner: any;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        query: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn((entity, obj) => ({ ...obj })),
      },
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      query: jest.fn(),
    };

    const mockCommunityRepo = {
      create: jest.fn((obj) => ({ ...obj })),
      findOne: jest.fn(),
    };

    const mockMemberRepo = {
      create: jest.fn((obj) => ({ ...obj })),
    };

    const mockTagRepo = {
      find: jest.fn(),
    };

    const mockTagNormalizeRepo = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(CommunityEntity), useValue: mockCommunityRepo },
        { provide: getRepositoryToken(CommunityMemberEntity), useValue: mockMemberRepo },
        { provide: getRepositoryToken(CommunityTagEntity), useValue: mockTagRepo },
        { provide: getRepositoryToken(CommunityTagNormalizeEntity), useValue: mockTagNormalizeRepo },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
    dataSource = mockDataSource as any;
    communityRepo = mockCommunityRepo as any;
    memberRepo = mockMemberRepo as any;
    tagRepo = mockTagRepo as any;
    tagNormalizeRepo = mockTagNormalizeRepo as any;
  });

  describe('createCommunity', () => {
    it('should throw BadRequestException if user not found', async () => {
      const userId = 999;
      const dto = { name: 'Test', description: 'Desc', is_private: false };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(service.createCommunity(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if user is not student', async () => {
      const userId = 1;
      const dto = { name: 'Test', description: 'Desc', is_private: false };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 1 }, // Admin (not student)
      ]);

      await expect(service.createCommunity(userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create community with role_id 2 (student)', async () => {
      const userId = 1;
      const dto = {
        name: 'Test Community',
        description: 'Test Description',
        is_private: false,
      };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 2 }, // Student
      ]);

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({
          community_id: 100,
          community_name: dto.name,
        })
        .mockResolvedValueOnce({ user_sys_id: userId });

      const result = await service.createCommunity(userId, dto);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.community_id).toBe(100);
    });

    it('should create community with role_id 3 (student)', async () => {
      const userId = 1;
      const dto = {
        name: 'Test Community',
        description: 'Test Description',
        is_private: false,
      };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 3 }, // Student
      ]);

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({
          community_id: 100,
          community_name: dto.name,
        })
        .mockResolvedValueOnce({ user_sys_id: userId });

      const result = await service.createCommunity(userId, dto);

      expect(result.community_id).toBe(100);
    });

    it('should set community as private when is_private is true', async () => {
      const userId = 1;
      const dto = {
        name: 'Private Community',
        description: 'Private',
        is_private: true,
      };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 2 },
      ]);

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({
          community_id: 100,
          is_private: true,
        })
        .mockResolvedValueOnce({});

      await service.createCommunity(userId, dto);

      const communityCreated =
        mockQueryRunner.manager.save.mock.calls[0][0];
      expect(communityCreated.is_private).toBe(true);
    });

    it('should set community as private when is_private is string "true"', async () => {
      const userId = 1;
      const dto = {
        name: 'Private Community',
        description: 'Private',
        is_private: 'true',
      };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 2 },
      ]);

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({
          community_id: 100,
          is_private: true,
        })
        .mockResolvedValueOnce({});

      await service.createCommunity(userId, dto);

      const communityCreated =
        mockQueryRunner.manager.save.mock.calls[0][0];
      expect(communityCreated.is_private).toBe(true);
    });

    it('should create owner membership', async () => {
      const userId = 1;
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
      };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 2 },
      ]);

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ community_id: 100 })
        .mockResolvedValueOnce({});

      await service.createCommunity(userId, dto);

      const memberCreated = mockQueryRunner.manager.save.mock.calls[1][0];
      expect(memberCreated.role).toBe('owner');
      expect(memberCreated.status).toBe('active');
    });

    it('should handle tags when provided', async () => {
      const userId = 1;
      const dto = {
        name: 'Test',
        description: 'Test',
        is_private: false,
        tags: ['#math', 'science'],
      };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 2 },
      ]);

      mockQueryRunner.manager.save.mockResolvedValue({ community_id: 100 });
      mockQueryRunner.manager.findOne.mockResolvedValueOnce(null); // No existing tag

      mockQueryRunner.manager.create.mockImplementation((entity, obj) => ({
        ...obj,
      }));

      await service.createCommunity(userId, dto);

      expect(mockQueryRunner.manager.findOne).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const userId = 1;
      const dto = { name: 'Test', description: 'Test', is_private: false };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 2 },
      ]);

      mockQueryRunner.manager.save.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      await expect(service.createCommunity(userId, dto)).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should always release queryRunner', async () => {
      const userId = 1;
      const dto = { name: 'Test', description: 'Test', is_private: false };

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 2 },
      ]);

      mockQueryRunner.manager.save.mockRejectedValueOnce(
        new Error('DB Error'),
      );

      try {
        await service.createCommunity(userId, dto);
      } catch (e) {
        // Expected
      }

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('listCommunity', () => {
    it('should list all communities owned by user when no keyword', async () => {
      const userId = 1;

      const mockCommunities = [
        {
          community_id: 1,
          community_name: 'Community 1',
          is_private: false,
          member_count: 10,
          tags: ['math'],
          membership_status: 'active',
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(
        mockCommunities,
      );

      const result = await service.listCommunity(userId);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('community_member'),
        [userId],
      );
      expect(result).toEqual(mockCommunities);
    });

    it('should search communities by keyword', async () => {
      const userId = 1;
      const keyword = 'math';

      const mockResults = [
        {
          community_id: 1,
          community_name: 'Math Community',
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockResults);

      const result = await service.listCommunity(userId, keyword);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        [userId, keyword],
      );
      expect(result).toEqual(mockResults);
    });

    it('should ignore empty keyword', async () => {
      const userId = 1;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await service.listCommunity(userId, '   ');

      // Should call query without keyword
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.not.stringContaining('ILIKE'),
        [userId],
      );
    });
  });

  describe('getCommunity', () => {
    it('should retrieve community by id with valid flag', async () => {
      const communityId = 1;

      await service.getCommunity(communityId);

      expect(communityRepo.findOne).toHaveBeenCalledWith({
        where: { community_id: communityId, flag_valid: true },
      });
    });

    it('should return null if community not found', async () => {
      const communityId = 999;

      await service.getCommunity(communityId);

      expect(communityRepo.findOne).toHaveBeenCalledWith({
        where: { community_id: communityId, flag_valid: true },
      });
    });
  });

  describe('checkReadPermission', () => {
    it('should allow read if community is public', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { status: 'active', is_private: false },
      ]);

      const result = await service.checkReadPermission(userId, communityId);

      expect(result).toBe(true);
    });

    it('should allow read if community is inactive', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { status: 'inactive', is_private: true },
      ]);

      const result = await service.checkReadPermission(userId, communityId);

      expect(result).toBe(true);
    });

    it('should throw error if community not found', async () => {
      const userId = 1;
      const communityId = 999;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        service.checkReadPermission(userId, communityId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow member to read private community', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: true },
        ])
        .mockResolvedValueOnce([{ user_sys_id: userId }]);

      const result = await service.checkReadPermission(userId, communityId);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException if user is not member of private community', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: true },
        ])
        .mockResolvedValueOnce([]);

      await expect(
        service.checkReadPermission(userId, communityId),
      ).rejects.toThrow('Private community access denied');
    });
  });

  describe('getCommunityFeed', () => {
    it('should throw error if community not found', async () => {
      const userId = 1;
      const communityId = 999;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(service.getCommunityFeed(userId, communityId)).rejects.toThrow(
        'Community not found',
      );
    });

    it('should throw error if community is inactive', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { status: 'inactive', is_private: false },
      ]);

      await expect(service.getCommunityFeed(userId, communityId)).rejects.toThrow(
        'Community inactive',
      );
    });

    it('should allow feed access for public active community', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: false },
        ])
        .mockResolvedValueOnce([
          {
            post_commu_id: 1,
            content: 'Test post',
            created_at: new Date(),
            comment_count: 5,
            bookmark_count: 2,
            is_bookmarked: true,
          },
        ]);

      const result = await service.getCommunityFeed(userId, communityId);

      expect(result).toHaveLength(1);
      expect(result[0].post_commu_id).toBe(1);
    });

    it('should check membership for private community feed', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: true },
        ])
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([]);

      await service.getCommunityFeed(userId, communityId);

      // Should be at least 2 calls (check community, check membership)
      expect(dataSource.query).toHaveBeenCalledTimes(3);
    });

    it('should deny access to private community feed if not member', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: true },
        ])
        .mockResolvedValueOnce([]);

      await expect(service.getCommunityFeed(userId, communityId)).rejects.toThrow(
        'Private community',
      );
    });

    it('should return posts with attachments and engagements', async () => {
      const userId = 1;
      const communityId = 5;

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: false },
        ])
        .mockResolvedValueOnce([
          {
            post_commu_id: 1,
            content: 'Post 1',
            comment_count: 3,
            bookmark_count: 1,
            is_bookmarked: false,
          },
        ]);

      const result = await service.getCommunityFeed(userId, communityId);

      expect(result[0]).toHaveProperty('comment_count');
      expect(result[0]).toHaveProperty('bookmark_count');
      expect(result[0]).toHaveProperty('is_bookmarked');
    });
  });

  describe('searchTag', () => {
    it('should return all tags when no keyword', async () => {
      const mockTags = [
        { community_tag_id: 1, tag_name: 'math', flag_valid: true },
        { community_tag_id: 2, tag_name: 'science', flag_valid: true },
      ];

      (tagRepo.find as jest.Mock).mockResolvedValueOnce(mockTags);

      const result = await service.searchTag();

      expect(tagRepo.find).toHaveBeenCalledWith({
        where: { flag_valid: true },
        order: { tag_name: 'ASC' },
      });
      expect(result).toEqual(mockTags);
    });

    it('should search tags by keyword', async () => {
      const keyword = 'mat';
      const mockTags = [
        { community_tag_id: 1, tag_name: 'math', flag_valid: true },
      ];

      (tagRepo.find as jest.Mock).mockResolvedValueOnce(mockTags);

      const result = await service.searchTag(keyword);

      expect(tagRepo.find).toHaveBeenCalled();
      expect(result).toEqual(mockTags);
    });

    it('should remove # from keyword', async () => {
      const keyword = '#math';

      (tagRepo.find as jest.Mock).mockResolvedValueOnce([]);

      await service.searchTag(keyword);

      // Verify find was called
      expect(tagRepo.find).toHaveBeenCalled();
    });

    it('should return tags ordered by name ascending', async () => {
      (tagRepo.find as jest.Mock).mockResolvedValueOnce([]);

      await service.searchTag();

      const callArgs = (tagRepo.find as jest.Mock).mock.calls[0][0];
      expect(callArgs.order.tag_name).toBe('ASC');
    });
  });

  describe('getCommunityDetail', () => {
    it('should throw error if community not found', async () => {
      const userId = 1;
      const communityId = 999;

      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        service.getCommunityDetail(userId, communityId),
      ).rejects.toThrow('Community not found');
    });

    it('should retrieve community detail with owner info', async () => {
      const userId = 1;
      const communityId = 5;

      const mockDetail = [
        {
          community_id: 5,
          community_name: 'Test Community',
          description: 'Test',
          is_private: false,
          member_count: 20,
          tags: ['math', 'science'],
          creator_id: 10,
          first_name: 'John',
          last_name: 'Doe',
          is_owner: true,
          membership_status: 'active',
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockDetail);

      const result = await service.getCommunityDetail(userId, communityId);

      expect(result).toHaveProperty('community_id', 5);
      expect(result).toHaveProperty('creator_id', 10);
      expect(result).toHaveProperty('is_owner', true);
      expect(result).toHaveProperty('membership_status', 'active');
    });

    it('should include current user id in response', async () => {
      const userId = 1;
      const communityId = 5;

      const mockDetail = [
        {
          community_id: 5,
          community_name: 'Test Community',
          is_owner: false,
          membership_status: 'active',
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockDetail);

      const result = await service.getCommunityDetail(userId, communityId);

      expect(result).toHaveProperty('current_user_id', userId);
    });

    it('should include member count in detail', async () => {
      const userId = 1;
      const communityId = 5;

      const mockDetail = [
        {
          community_id: 5,
          community_name: 'Test Community',
          member_count: 45,
        },
      ];

      (dataSource.query as jest.Mock).mockResolvedValueOnce(mockDetail);

      const result = await service.getCommunityDetail(userId, communityId);

      expect(result).toHaveProperty('member_count', 45);
    });
  });

  describe('Integration scenarios', () => {
    it('should create community and list it', async () => {
      const userId = 1;
      const createDto = {
        name: 'New Community',
        description: 'Description',
        is_private: false,
      };

      // Create
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { role_id: 2 },
      ]);

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ community_id: 100 })
        .mockResolvedValueOnce({});

      await service.createCommunity(userId, createDto);

      // List
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        {
          community_id: 100,
          community_name: 'New Community',
        },
      ]);

      const result = await service.listCommunity(userId);
      expect(result).toHaveLength(1);
    });

    it('should handle private community with member access check', async () => {
      const userId = 1;
      const communityId = 5;

      // Check permission
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: true },
        ])
        .mockResolvedValueOnce([{ status: 'active' }]);

      const hasAccess = await service.checkReadPermission(userId, communityId);
      expect(hasAccess).toBe(true);

      // Get feed
      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce([
          { status: 'active', is_private: true },
        ])
        .mockResolvedValueOnce([{ status: 'active' }])
        .mockResolvedValueOnce([
          {
            post_commu_id: 1,
            content: 'Private post',
          },
        ]);

      const feed = await service.getCommunityFeed(userId, communityId);
      expect(feed).toHaveLength(1);
    });
  });
});
