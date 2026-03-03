import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { RoomLocationService } from './room-location.service';
import { RoomLocation } from './entities/room-location.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockRoom = (overrides: Partial<RoomLocation> = {}): RoomLocation =>
  ({
    room_location_id: 1,
    building_id: 1,
    room_number: '101',
    room_remark: null,
    floor: '1',
    flag_valid: true,
    ...overrides,
  }) as RoomLocation;

// ─── QueryRunner mock factory ─────────────────────────────────────────────────

const buildQueryRunnerMock = (queryResult: any = []) => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  query: jest.fn().mockResolvedValue(queryResult),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RoomLocationService', () => {
  let service: RoomLocationService;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
    createQueryRunner: jest.fn(),
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
        RoomLocationService,
        { provide: getRepositoryToken(RoomLocation), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<RoomLocationService>(RoomLocationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return room location when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockRoom());

      const result = await service.findById(1);

      expect(result).toEqual(mockRoom());
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { room_location_id: 1 },
      });
    });

    it('should throw NotFoundException when room location does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when filtering by room_location_id', async () => {
      mockDataSource.query.mockResolvedValue([mockRoom()]);

      const result = await service.search({ room_location_id: 1 });

      expect(result).toEqual([mockRoom()]);
      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when filtering by building_id', async () => {
      mockDataSource.query.mockResolvedValue([mockRoom()]);

      const result = await service.search({ building_id: 1 });

      expect(result).toEqual([mockRoom()]);
    });

    it('should return results when filtering by room_number', async () => {
      mockDataSource.query.mockResolvedValue([mockRoom()]);

      const result = await service.search({ room_number: '101' });

      expect(result).toEqual([mockRoom()]);
    });

    it('should return results when filtering by room_remark', async () => {
      mockDataSource.query.mockResolvedValue([mockRoom()]);

      const result = await service.search({ room_remark: 'Conference room' });

      expect(result).toEqual([mockRoom()]);
    });

    it('should return results when filtering by flag_valid true', async () => {
      mockDataSource.query.mockResolvedValue([mockRoom()]);

      const result = await service.search({ flag_valid: true });

      expect(result).toEqual([mockRoom()]);
    });

    it('should return results when filtering by flag_valid false', async () => {
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.search({ flag_valid: false });

      expect(result).toEqual([]);
    });

    it('should apply sort and pagination in query', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        building_id: 1,
        sort_by: 'room_number',
        sort_order: 'DESC',
        limit: 10,
        offset: 5,
      });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('DESC');
      expect(queryStr).toContain('LIMIT');
      expect(queryStr).toContain('OFFSET');
      expect(values).toContain(10);
      expect(values).toContain(5);
    });

    it('should default sort to ASC when sort_order is not DESC', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ building_id: 1, sort_by: 'room_number' });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ASC');
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.search({ building_id: 1 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = { building_id: 1, room_number: '101' };

    it('should throw BadRequestException when building_id is missing', async () => {
      await expect(
        service.create({ building_id: 0, room_number: '101' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when room_number is missing', async () => {
      await expect(
        service.create({ building_id: 1, room_number: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a room location and return the saved record', async () => {
      const created = mockRoom();
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.create(createDto);

      expect(result).toEqual(created);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          building_id: 1,
          room_number: '101',
          flag_valid: true,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(created);
    });

    it('should set room_remark to null when not provided', async () => {
      mockRepo.create.mockReturnValue(mockRoom());
      mockRepo.save.mockResolvedValue(mockRoom());

      await service.create(createDto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ room_remark: null }),
      );
    });

    it('should pass room_remark when provided', async () => {
      mockRepo.create.mockReturnValue(mockRoom({ room_remark: 'Office' }));
      mockRepo.save.mockResolvedValue(mockRoom({ room_remark: 'Office' }));

      await service.create({ ...createDto, room_remark: 'Office' });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ room_remark: 'Office' }),
      );
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      mockRepo.create.mockReturnValue(mockRoom());
      mockRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other save error', async () => {
      mockRepo.create.mockReturnValue(mockRoom());
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createBatch ───────────────────────────────────────────────────────────

  describe('createBatch', () => {
    const validRooms = [
      { building_id: 1, room_number: '101' },
      { building_id: 1, room_number: '102' },
    ];

    it('should throw BadRequestException when rooms array is empty', async () => {
      await expect(service.createBatch({ rooms: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when rooms is undefined', async () => {
      await expect(
        service.createBatch({ rooms: undefined as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when a room is missing required fields', async () => {
      await expect(
        service.createBatch({
          rooms: [{ building_id: 0, room_number: '101' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when payload contains duplicate rooms', async () => {
      await expect(
        service.createBatch({
          rooms: [
            { building_id: 1, room_number: '101' },
            { building_id: 1, room_number: '101' },
          ],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create rooms in batch and return success response', async () => {
      const qr = buildQueryRunnerMock([
        { room_location_id: 1, building_id: 1, room_number: '101' },
        { room_location_id: 2, building_id: 1, room_number: '102' },
      ]);
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      const result = await service.createBatch({ rooms: validRooms });

      expect(result.success).toBe(true);
      expect(result.message).toContain('2');
      expect(result.data).toHaveLength(2);
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('should rollback and throw ConflictException on duplicate DB error (code 23505)', async () => {
      const qr = buildQueryRunnerMock();
      qr.query.mockRejectedValue({ code: '23505' });
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await expect(service.createBatch({ rooms: validRooms })).rejects.toThrow(
        ConflictException,
      );
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('should rollback and throw InternalServerErrorException on other DB error', async () => {
      const qr = buildQueryRunnerMock();
      qr.query.mockRejectedValue(new Error('DB error'));
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await expect(service.createBatch({ rooms: validRooms })).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('should always release queryRunner even on error', async () => {
      const qr = buildQueryRunnerMock();
      qr.query.mockRejectedValue(new Error('DB error'));
      mockDataSource.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.createBatch({ rooms: validRooms }),
      ).rejects.toThrow();
      expect(qr.release).toHaveBeenCalledTimes(1);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when room location does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { room_number: '202' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockRepo.findOne.mockResolvedValue(mockRoom());

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should update room_number and return updated record', async () => {
      const updated = mockRoom({ room_number: '202' });
      mockRepo.findOne
        .mockResolvedValueOnce(mockRoom())
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { room_number: '202' });

      expect(result).toEqual(updated);
      expect(mockRepo.update).toHaveBeenCalledWith(
        { room_location_id: 1 },
        expect.objectContaining({ room_number: '202' }),
      );
    });

    it('should update building_id', async () => {
      const updated = mockRoom({ building_id: 2 });
      mockRepo.findOne
        .mockResolvedValueOnce(mockRoom())
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { building_id: 2 });

      expect(result!.building_id).toBe(2);
    });

    it('should update room_remark', async () => {
      const updated = mockRoom({ room_remark: 'New remark' });
      mockRepo.findOne
        .mockResolvedValueOnce(mockRoom())
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { room_remark: 'New remark' });

      expect(result!.room_remark).toBe('New remark');
    });

    it('should update flag_valid to false', async () => {
      const updated = mockRoom({ flag_valid: false });
      mockRepo.findOne
        .mockResolvedValueOnce(mockRoom())
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update(1, { flag_valid: false });

      expect(result!.flag_valid).toBe(false);
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      mockRepo.findOne.mockResolvedValue(mockRoom());
      mockRepo.update.mockRejectedValue({ code: '23505' });

      await expect(service.update(1, { room_number: 'dup' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other update error', async () => {
      mockRepo.findOne.mockResolvedValue(mockRoom());
      mockRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(service.update(1, { room_number: 'error' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when room location does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete room location and return the deleted record', async () => {
      const existing = mockRoom();
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result).toEqual(existing);
      expect(mockRepo.delete).toHaveBeenCalledWith({ room_location_id: 1 });
    });

    it('should throw InternalServerErrorException on delete error', async () => {
      mockRepo.findOne.mockResolvedValue(mockRoom());
      mockRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
