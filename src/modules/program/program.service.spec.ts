import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ProgramService } from './program.service';
import { Program } from './entities/program.entity';
import { UserSysProgramNormalize } from './entities/user-sys-program-normalize.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockProgram = (overrides: Partial<Program> = {}): Program =>
  ({
    program_id: 1,
    inst_id: 1,
    program_name: 'Computer Science',
    program_type: 'major',
    tree_type: 'leaf',
    parent_id: null,
    remark: null,
    flag_valid: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    ...overrides,
  }) as Program;

const mockNorm = (
  overrides: Partial<UserSysProgramNormalize> = {},
): UserSysProgramNormalize =>
  ({
    program_id: 1,
    user_sys_id: 10,
    flag_valid: true,
    ...overrides,
  }) as UserSysProgramNormalize;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('ProgramService', () => {
  let service: ProgramService;

  const mockProgramRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockNormRepo = {
    create: jest.fn(),
    save: jest.fn(),
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
        ProgramService,
        { provide: getRepositoryToken(Program), useValue: mockProgramRepo },
        {
          provide: getRepositoryToken(UserSysProgramNormalize),
          useValue: mockNormRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ProgramService>(ProgramService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return the program when found', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());

      const result = await service.findById(1);

      expect(result).toEqual(mockProgram());
      expect(mockProgramRepo.findOne).toHaveBeenCalledWith({
        where: { program_id: 1 },
      });
    });

    it('should throw NotFoundException when program does not exist', async () => {
      mockProgramRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return results when filtering by program_id', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ program_id: 1 });

      expect(result).toEqual([mockProgram()]);
      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should return results when filtering by inst_id', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ inst_id: 1 });

      expect(result).toEqual([mockProgram()]);
    });

    it('should return results when filtering by program_name', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ program_name: 'Computer Science' });

      expect(result).toEqual([mockProgram()]);
    });

    it('should return results when filtering by program_type', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ program_type: 'major' });

      expect(result).toEqual([mockProgram()]);
    });

    it('should return results when filtering by parent_id', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ parent_id: 2 });

      expect(result).toEqual([mockProgram()]);
    });

    it('should return results when filtering by tree_type', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ tree_type: 'leaf' });

      expect(result).toEqual([mockProgram()]);
    });

    it('should return results when filtering by flag_valid', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ flag_valid: true });

      expect(result).toEqual([mockProgram()]);
    });

    it('should return results when filtering by inst_type', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ inst_type: 'school' });

      expect(result).toEqual([mockProgram()]);
    });

    it('should return results when filtering by parent_ids', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      const result = await service.search({ parent_ids: 2 });

      expect(result).toEqual([mockProgram()]);
    });

    it('should include ILIKE clause and push keyword values when keyword is provided', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      await service.search({ inst_id: 1, keyword: 'science' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ILIKE');
      expect(values).toContain('%science%');
    });

    it('should include children_count subquery when children_count is true', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      await service.search({ inst_id: 1, children_count: true });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('children_count');
      expect(queryStr).toContain('RECURSIVE');
    });

    it('should apply sort and pagination when provided', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        inst_id: 1,
        sort_by: 'program_name',
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

    it('should default sort order to ASC when sort_order is not DESC', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({
        inst_id: 1,
        sort_by: 'program_name',
        sort_order: 'ASC',
      });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ASC');
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
      program_name: 'Computer Science',
      program_type: 'major',
      tree_type: 'leaf' as const,
    };

    it('should throw BadRequestException when required fields are missing', async () => {
      await expect(
        service.create({
          inst_id: 0,
          program_name: '',
          program_type: '',
          tree_type: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(
        service.create({
          inst_id: 0,
          program_name: 'CS',
          program_type: 'major',
          tree_type: 'leaf',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when program_name is missing', async () => {
      await expect(
        service.create({
          inst_id: 1,
          program_name: '',
          program_type: 'major',
          tree_type: 'leaf',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when program_type is missing', async () => {
      await expect(
        service.create({
          inst_id: 1,
          program_name: 'CS',
          program_type: '',
          tree_type: 'leaf',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when tree_type is missing', async () => {
      await expect(
        service.create({
          inst_id: 1,
          program_name: 'CS',
          program_type: 'major',
          tree_type: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a program and return the created record', async () => {
      const created = mockProgram();
      mockDataSource.query.mockResolvedValue([created]);

      const result = await service.create(createDto);

      expect(result).toEqual(created);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO program'),
        expect.arrayContaining([
          createDto.inst_id,
          createDto.program_name,
          createDto.program_type,
          createDto.tree_type,
        ]),
      );
    });

    it('should pass null for parent_id and remark when not provided', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      await service.create(createDto);

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values[4]).toBeNull(); // parent_id
      expect(values[5]).toBeNull(); // remark
    });

    it('should pass parent_id and remark when provided', async () => {
      mockDataSource.query.mockResolvedValue([mockProgram()]);

      await service.create({
        ...createDto,
        parent_id: 5,
        remark: 'Some note',
      });

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values[4]).toBe(5);
      expect(values[5]).toBe('Some note');
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      const duplicateError = { code: '23505' };
      mockDataSource.query.mockRejectedValue(duplicateError);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when program does not exist', async () => {
      mockProgramRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { program_name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should update program_name and return updated record', async () => {
      const updated = mockProgram({ program_name: 'Updated CS' });
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.update(1, { program_name: 'Updated CS' });

      expect(result).toEqual(updated);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE program SET'),
        expect.arrayContaining(['Updated CS', 1]),
      );
    });

    it('should update inst_id', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      mockDataSource.query.mockResolvedValue([mockProgram({ inst_id: 2 })]);

      const result = await service.update(1, { inst_id: 2 });

      expect(result.inst_id).toBe(2);
    });

    it('should update program_type', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      mockDataSource.query.mockResolvedValue([
        mockProgram({ program_type: 'faculty' }),
      ]);

      const result = await service.update(1, { program_type: 'faculty' });

      expect(result.program_type).toBe('faculty');
    });

    it('should update parent_id', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      mockDataSource.query.mockResolvedValue([mockProgram({ parent_id: 3 })]);

      const result = await service.update(1, { parent_id: 3 });

      expect(result.parent_id).toBe(3);
    });

    it('should update remark', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      mockDataSource.query.mockResolvedValue([
        mockProgram({ remark: 'new note' }),
      ]);

      const result = await service.update(1, { remark: 'new note' });

      expect(result.remark).toBe('new note');
    });

    it('should update flag_valid to false', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      mockDataSource.query.mockResolvedValue([
        mockProgram({ flag_valid: false }),
      ]);

      const result = await service.update(1, { flag_valid: false });

      expect(result.flag_valid).toBe(false);
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      const duplicateError = { code: '23505' };
      mockDataSource.query.mockRejectedValue(duplicateError);

      await expect(
        service.update(1, { program_name: 'Duplicate' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update(1, { program_name: 'Error' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when program does not exist', async () => {
      mockProgramRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete program and return deleted record', async () => {
      const existing = mockProgram();
      mockProgramRepo.findOne.mockResolvedValue(existing);
      mockProgramRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result).toEqual(existing);
      expect(mockProgramRepo.delete).toHaveBeenCalledWith({ program_id: 1 });
    });

    it('should throw InternalServerErrorException on delete error', async () => {
      mockProgramRepo.findOne.mockResolvedValue(mockProgram());
      mockProgramRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createUserSysNormalize ────────────────────────────────────────────────

  describe('createUserSysNormalize', () => {
    const dto = { program_id: 1, user_sys_id: 10 };

    it('should throw BadRequestException when program_id is missing', async () => {
      await expect(
        service.createUserSysNormalize({ program_id: 0, user_sys_id: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user_sys_id is missing', async () => {
      await expect(
        service.createUserSysNormalize({ program_id: 1, user_sys_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create and return the normalized record', async () => {
      const created = mockNorm();
      mockNormRepo.create.mockReturnValue(created);
      mockNormRepo.save.mockResolvedValue(created);

      const result = await service.createUserSysNormalize(dto);

      expect(result).toEqual(created);
      expect(mockNormRepo.create).toHaveBeenCalledWith({
        program_id: 1,
        user_sys_id: 10,
        flag_valid: true,
      });
      expect(mockNormRepo.save).toHaveBeenCalledWith(created);
    });

    it('should throw ConflictException on duplicate entry (code 23505)', async () => {
      const duplicateError = { code: '23505' };
      mockNormRepo.create.mockReturnValue(mockNorm());
      mockNormRepo.save.mockRejectedValue(duplicateError);

      await expect(service.createUserSysNormalize(dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other save error', async () => {
      mockNormRepo.create.mockReturnValue(mockNorm());
      mockNormRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createUserSysNormalize(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── updateUserSysNormalize ────────────────────────────────────────────────

  describe('updateUserSysNormalize', () => {
    it('should throw BadRequestException when user_sys_id is missing', async () => {
      await expect(
        service.updateUserSysNormalize({ user_sys_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no fields to update', async () => {
      await expect(
        service.updateUserSysNormalize({ user_sys_id: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update program_id and return updated record', async () => {
      const updated = mockNorm({ program_id: 2 });
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.updateUserSysNormalize({
        user_sys_id: 10,
        program_id: 2,
      });

      expect(result).toEqual(updated);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_sys_program_normalize'),
        expect.arrayContaining([2, 10]),
      );
    });

    it('should update flag_valid and return updated record', async () => {
      const updated = mockNorm({ flag_valid: false });
      mockDataSource.query.mockResolvedValue([updated]);

      const result = await service.updateUserSysNormalize({
        user_sys_id: 10,
        flag_valid: false,
      });

      expect(result.flag_valid).toBe(false);
    });

    it('should throw NotFoundException when record is not found (empty result)', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(
        service.updateUserSysNormalize({ user_sys_id: 10, program_id: 2 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateUserSysNormalize({ user_sys_id: 10, program_id: 2 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── deleteUserSysNormalize ────────────────────────────────────────────────

  describe('deleteUserSysNormalize', () => {
    const dto = { program_id: 1, user_sys_id: 10 };

    it('should throw BadRequestException when program_id is missing', async () => {
      await expect(
        service.deleteUserSysNormalize({ program_id: 0, user_sys_id: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user_sys_id is missing', async () => {
      await expect(
        service.deleteUserSysNormalize({ program_id: 1, user_sys_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete and return the deleted record', async () => {
      const deleted = mockNorm();
      mockDataSource.query.mockResolvedValue([deleted]);

      const result = await service.deleteUserSysNormalize(dto);

      expect(result).toEqual(deleted);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_sys_program_normalize'),
        [1, 10],
      );
    });

    it('should throw NotFoundException when record is not found (empty result)', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.deleteUserSysNormalize(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on query error', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteUserSysNormalize(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createUserSysNormalizeInternal ───────────────────────────────────────

  describe('createUserSysNormalizeInternal', () => {
    it('should throw BadRequestException when user_sys_id is missing', async () => {
      await expect(
        service.createUserSysNormalizeInternal(0, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when program_id is missing', async () => {
      await expect(
        service.createUserSysNormalizeInternal(10, 0),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create and return the normalized record', async () => {
      const created = mockNorm();
      mockNormRepo.create.mockReturnValue(created);
      mockNormRepo.save.mockResolvedValue(created);

      const result = await service.createUserSysNormalizeInternal(10, 1);

      expect(result).toEqual(created);
      expect(mockNormRepo.create).toHaveBeenCalledWith({
        program_id: 1,
        user_sys_id: 10,
        flag_valid: true,
      });
    });

    it('should rethrow any error from save', async () => {
      const error = new Error('DB failure');
      mockNormRepo.create.mockReturnValue(mockNorm());
      mockNormRepo.save.mockRejectedValue(error);

      await expect(
        service.createUserSysNormalizeInternal(10, 1),
      ).rejects.toThrow('DB failure');
    });
  });
});
