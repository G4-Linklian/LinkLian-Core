import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityEntity } from './entities/community.entity';
import { CommunityMemberEntity } from '../member/entities/community-member.entity';
import { CommunityTagEntity } from './entities/community-tag.entity';
import { CommunityTagNormalizeEntity } from './entities/community-tag-normalize.entity';
import { AppLogger } from 'src/common/logger/app-logger.service';

describe('CommunityService', () => {
  let service: CommunityService;
  let dataSource: DataSource;
  let communityRepo: Repository<CommunityEntity>;
  let tagRepo: Repository<CommunityTagEntity>;
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

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: getRepositoryToken(CommunityEntity),
          useValue: mockCommunityRepo,
        },
        {
          provide: getRepositoryToken(CommunityMemberEntity),
          useValue: mockMemberRepo,
        },
        {
          provide: getRepositoryToken(CommunityTagEntity),
          useValue: mockTagRepo,
        },
        {
          provide: getRepositoryToken(CommunityTagNormalizeEntity),
          useValue: mockTagNormalizeRepo,
        },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
    dataSource = mockDataSource as any;
    communityRepo = mockCommunityRepo as any;
    tagRepo = mockTagRepo as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCommunity', () => {
    it('should throw BadRequestException if user not found', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(
        service.createCommunity(999, {
          name: 'Test',
          description: 'Desc',
          is_private: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if user not student', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([{ role_id: 1 }]);

      await expect(
        service.createCommunity(1, {
          name: 'Test',
          description: 'Desc',
          is_private: false,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create community successfully', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([{ role_id: 2 }]);

      mockQueryRunner.manager.save
        .mockResolvedValueOnce({ community_id: 100 })
        .mockResolvedValueOnce({});

      const result = await service.createCommunity(1, {
        name: 'Test',
        description: 'Desc',
        is_private: false,
      });

      expect(result.data.community_id).toBe(100);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('listCommunity', () => {
    it('should list communities', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { community_id: 1 },
      ]);

      const result = await service.listCommunity(1);

      expect(result.data.communities).toHaveLength(1);
    });
  });

  describe('getCommunity', () => {
    it('should call findOne with flag_valid true', async () => {
      (communityRepo.findOne as jest.Mock).mockResolvedValueOnce({
        community_id: 1,
        flag_valid: true,
      });

      await service.getCommunity(1);

      expect(communityRepo.findOne).toHaveBeenCalledWith({
        where: { community_id: 1, flag_valid: true },
      });
    });
  });

  describe('checkReadPermission', () => {
    it('should allow public community', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { status: 'active', is_private: false },
      ]);

      const result = await service.checkReadPermission(1, 5);
      expect(result).toBe(true);
    });
  });

  describe('getCommunityFeed', () => {
    it('should throw if not found', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(service.getCommunityFeed(1, 5)).rejects.toThrow();
    });
  });

  describe('searchTag', () => {
    it('should return all valid tags', async () => {
      (tagRepo.find as jest.Mock).mockResolvedValueOnce([]);

      await service.searchTag();

      expect(tagRepo.find).toHaveBeenCalledWith({
        where: { flag_valid: true },
        order: { tag_name: 'ASC' },
      });
    });
  });

  describe('getCommunityDetail', () => {
    it('should throw if not found', async () => {
      (dataSource.query as jest.Mock).mockResolvedValueOnce([]);

      await expect(service.getCommunityDetail(1, 5)).rejects.toThrow();
    });
  });
});
