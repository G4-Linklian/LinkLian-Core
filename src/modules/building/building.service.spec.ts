import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { BuildingService } from './building.service';
import { Building } from './entities/building.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockBuilding = (overrides: Partial<Building> = {}): Building =>
  ({
    building_id: 1,
    inst_id: 1,
    building_no: 'A1',
    building_name: 'Main Building',
    remark: 'Near parking lot',
    flag_valid: true,
    ...overrides,
  }) as Building;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('BuildingService', () => {
  let service: BuildingService;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  const mockLogger: Partial<AppLogger> = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildingService,
        { provide: getRepositoryToken(Building), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<BuildingService>(BuildingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException when building does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('should return building data on success', async () => {
      mockRepo.findOne.mockResolvedValue(mockBuilding());

      const result = await service.findById(1);

      expect(result).toEqual({ success: true, data: mockBuilding() });
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { building_id: 1 },
      });
    });
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when searching by inst_id', async () => {
      mockDataSource.query.mockResolvedValue([mockBuilding()]);

      const result = await service.search({ inst_id: 1 });

      expect(result).toEqual({ success: true, data: [mockBuilding()] });
      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when searching by building_id', async () => {
      mockDataSource.query.mockResolvedValue([mockBuilding()]);

      const result = await service.search({ building_id: 1 });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by building_name', async () => {
      mockDataSource.query.mockResolvedValue([mockBuilding()]);

      const result = await service.search({ building_name: 'Main Building' });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by building_no', async () => {
      mockDataSource.query.mockResolvedValue([mockBuilding()]);

      const result = await service.search({ building_no: 'A1' });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by remark', async () => {
      mockDataSource.query.mockResolvedValue([mockBuilding()]);

      const result = await service.search({ remark: 'Near parking lot' });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([mockBuilding()]);

      const result = await service.search({ flag_valid: true });

      expect(result.success).toBe(true);
    });

    it('should apply keyword filter in query', async () => {
      mockDataSource.query.mockResolvedValue([mockBuilding()]);

      const result = await service.search({ inst_id: 1, keyword: 'Main' });

      expect(result.success).toBe(true);
      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ILIKE');
      expect(values).toContain('%Main%');
    });

    it('should apply sort and pagination in query', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        inst_id: 1,
        sort_by: 'building_name',
        sort_order: 'DESC',
        limit: 10,
        offset: 0,
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('DESC');
      expect(queryStr).toContain('LIMIT');
      expect(values).toContain(10);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.search({ inst_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      inst_id: 1,
      building_no: 'A1',
      building_name: 'Main Building',
    };

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.create({ inst_id: 0, building_no: '', building_name: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(
        service.create({
          inst_id: 0,
          building_no: 'A1',
          building_name: 'Main',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when building_no is missing', async () => {
      await expect(
        service.create({ inst_id: 1, building_no: '', building_name: 'Main' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when building_name is missing', async () => {
      await expect(
        service.create({ inst_id: 1, building_no: 'A1', building_name: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a building and return success', async () => {
      const created = mockBuilding();
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(result).toMatchObject({
        success: true,
        message: 'Building created successfully',
        data: created,
      });
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inst_id: 1,
          building_no: 'A1',
          building_name: 'Main Building',
          flag_valid: true,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(created);
    });

    it('should set remark to null when not provided', async () => {
      const created = mockBuilding({ remark: null });
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      await service.create(createDto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ remark: null }),
      );
    });

    it('should throw InternalServerErrorException on save error', async () => {
      mockRepo.create.mockReturnValue(mockBuilding());
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when building does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { building_name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockRepo.findOne.mockResolvedValue(mockBuilding());

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should update building and return updated data', async () => {
      const updated = mockBuilding({ building_name: 'Updated Building' });
      mockRepo.findOne
        .mockResolvedValueOnce(mockBuilding()) // existence check
        .mockResolvedValueOnce(updated); // after update fetch
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, {
        building_name: 'Updated Building',
      });

      expect(result).toMatchObject({
        success: true,
        message: 'Building updated successfully',
        data: updated,
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        { building_id: 1 },
        expect.objectContaining({ building_name: 'Updated Building' }),
      );
    });

    it('should update flag_valid field', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(mockBuilding())
        .mockResolvedValueOnce(mockBuilding({ flag_valid: false }));
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { flag_valid: false });

      expect(result.success).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith(
        { building_id: 1 },
        expect.objectContaining({ flag_valid: false }),
      );
    });

    it('should throw InternalServerErrorException on update error', async () => {
      mockRepo.findOne.mockResolvedValue(mockBuilding());
      mockRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update(1, { building_name: 'Updated' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when building does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete building and return deleted data', async () => {
      const existing = mockBuilding();
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result).toMatchObject({
        success: true,
        message: 'Building deleted successfully',
        data: existing,
      });
      expect(mockRepo.delete).toHaveBeenCalledWith({ building_id: 1 });
    });

    it('should throw InternalServerErrorException on delete error', async () => {
      mockRepo.findOne.mockResolvedValue(mockBuilding());
      mockRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
