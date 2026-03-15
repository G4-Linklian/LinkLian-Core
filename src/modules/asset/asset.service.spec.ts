import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AssetService } from './asset.service';
import { AssetEntity } from './entities/asset.entity';
import { AppLogger } from '../../common/logger/app-logger.service';
import { FileStorageService } from '../file-storage/file-storage.service';

const mockAsset = (overrides: Partial<AssetEntity> = {}): AssetEntity =>
  ({
    theme_id: 1,
    theme_name: 'Theme A',
    theme_url: 'https://example.com/theme-a.png',
    start_date: null,
    end_date: null,
    is_default: false,
    status: 'pending',
    flag_valid: true,
    ...overrides,
  }) as unknown as AssetEntity;

const buildReadQb = (result: {
  one?: any;
  many?: any[];
  rawMany?: any[];
  rawOne?: any;
  manyAndCount?: [any[], number];
}) => {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(result.one),
    getMany: jest.fn().mockResolvedValue(result.many ?? []),
    getRawMany: jest.fn().mockResolvedValue(result.rawMany ?? []),
    getRawOne: jest.fn().mockResolvedValue(result.rawOne),
    getManyAndCount: jest
      .fn()
      .mockResolvedValue(result.manyAndCount ?? [result.many ?? [], 0]),
  };
  return qb;
};

const buildWriteQb = (executeResult?: any) => {
  const qb: any = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(executeResult ?? { raw: [] }),
  };
  return qb;
};

describe('AssetService', () => {
  let service: AssetService;

  const mockRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockLogger: Partial<AppLogger> = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const mockFileStorageService: Partial<FileStorageService> = {
    uploadFiles: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetService,
        { provide: getRepositoryToken(AssetEntity), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
        { provide: FileStorageService, useValue: mockFileStorageService },
      ],
    }).compile();

    service = module.get<AssetService>(AssetService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should throw BadRequestException when no input provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return rows with total_count', async () => {
      const syncQb = buildWriteQb();
      const searchRows = [mockAsset({ theme_id: 1 }), mockAsset({ theme_id: 2 })];
      const searchQb = buildReadQb({ manyAndCount: [searchRows, 2] });

      mockRepo.createQueryBuilder
        .mockReturnValueOnce(syncQb)
        .mockReturnValueOnce(searchQb);

      const result = await service.search({ theme_name: 'Theme' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({ total_count: 2 });
    });

    it('should throw InternalServerErrorException when query fails', async () => {
      const syncQb = buildWriteQb();
      const searchQb = buildReadQb({ manyAndCount: [[], 0] });
      searchQb.getManyAndCount.mockRejectedValueOnce(new Error('DB error'));

      mockRepo.createQueryBuilder
        .mockReturnValueOnce(syncQb)
        .mockReturnValueOnce(searchQb);

      await expect(service.search({ theme_name: 'Theme' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findById', () => {
    it('should throw NotFoundException when asset not found', async () => {
      const qb = buildReadQb({ one: null });
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('should return asset when found', async () => {
      const asset = mockAsset();
      const qb = buildReadQb({ one: asset });
      mockRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.findById(1);

      expect(result).toEqual({ success: true, data: asset });
    });
  });

  describe('create', () => {
    it('should throw BadRequestException when no theme_url and no file', async () => {
      await expect(
        service.create({
          theme_name: 'Theme',
          theme_url: '',
          is_default: false,
          flag_valid: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should upload file and insert asset inside transaction', async () => {
      (mockFileStorageService.uploadFiles as jest.Mock).mockResolvedValue({
        files: [{ fileUrl: 'https://cdn/theme-new.png' }],
      });

      const unsetDefaultQb = buildWriteQb();
      const insertQb = buildWriteQb({ raw: [mockAsset({ theme_id: 99, is_default: true })] });

      mockDataSource.transaction.mockImplementationOnce(async (callback: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValueOnce(unsetDefaultQb)
            .mockReturnValueOnce(insertQb),
        };
        return callback(manager);
      });

      const file = { originalname: 'theme.png' } as Express.Multer.File;
      const result = await service.create(
        {
          theme_name: 'Theme New',
          theme_url: '',
          is_default: true,
          flag_valid: true,
        },
        file,
      );

      expect(mockFileStorageService.uploadFiles).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.theme_id).toBe(99);
      expect(insertQb.insert).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when target asset not found', async () => {
      const findQb = buildReadQb({ one: null });
      mockRepo.createQueryBuilder.mockReturnValueOnce(findQb);

      await expect(service.update(77, { theme_name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clear dates when promoting existing dated asset to default', async () => {
      const existing = mockAsset({
        theme_id: 2,
        is_default: false,
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      });
      const findQb = buildReadQb({ one: existing });
      const updatedQb = buildReadQb({ one: mockAsset({ theme_id: 2, is_default: true }) });

      mockRepo.createQueryBuilder
        .mockReturnValueOnce(findQb)
        .mockReturnValueOnce(updatedQb);

      const unsetDefaultQb = buildWriteQb();
      const updateQb = buildWriteQb();

      mockDataSource.transaction.mockImplementationOnce(async (callback: any) => {
        const manager = {
          createQueryBuilder: jest
            .fn()
            .mockReturnValueOnce(unsetDefaultQb)
            .mockReturnValueOnce(updateQb),
        };
        return callback(manager);
      });

      const result = await service.update(2, { is_default: true });

      expect(updateQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          is_default: true,
          start_date: null,
          end_date: null,
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getActiveThemeUrl', () => {
    it('should return default theme_url when no active range found', async () => {
      const syncQb = buildWriteQb();
      const activeQb = buildReadQb({ rawMany: [] });
      const defaultQb = buildReadQb({ rawOne: { theme_url: 'https://default.png' } });

      mockRepo.createQueryBuilder
        .mockReturnValueOnce(syncQb)
        .mockReturnValueOnce(activeQb)
        .mockReturnValueOnce(defaultQb);

      const result = await service.getActiveThemeUrl();

      expect(result).toBe('https://default.png');
    });
  });

  describe('delete', () => {
    it('should reject deleting active asset', async () => {
      const syncQb = buildWriteQb();
      const findQb = buildReadQb({ one: mockAsset({ status: 'active', flag_valid: true }) });

      mockRepo.createQueryBuilder
        .mockReturnValueOnce(syncQb)
        .mockReturnValueOnce(findQb);

      await expect(service.delete(1)).rejects.toThrow(BadRequestException);
    });

    it('should delete asset when not active', async () => {
      const syncQb = buildWriteQb();
      const findQb = buildReadQb({ one: mockAsset({ status: 'completed', flag_valid: true }) });
      const deleteQb = buildWriteQb();

      mockRepo.createQueryBuilder
        .mockReturnValueOnce(syncQb)
        .mockReturnValueOnce(findQb)
        .mockReturnValueOnce(deleteQb);

      const result = await service.delete(1);

      expect(deleteQb.delete).toHaveBeenCalled();
      expect(result).toEqual({ success: true, message: 'Asset deleted successfully' });
    });
  });
});
