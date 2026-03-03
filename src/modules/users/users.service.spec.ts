import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { UsersService } from './users.service';
import { UserSys } from './entities/user-sys.entity';
import { LearningAreaService } from '../learning-area/learning-area.service';
import { ProgramService } from '../program/program.service';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Mock external utilities ─────────────────────────────────────────────────

jest.mock('../../common/utils/auth.util', () => ({
  generateInitialPassword: jest.fn().mockReturnValue('Init@1234'),
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
}));

jest.mock('../../common/utils/mailer.utils', () => ({
  sendInitialPasswordEmail: jest.fn().mockResolvedValue(undefined),
}));

import { generateInitialPassword, hashPassword } from '../../common/utils/auth.util';
import { sendInitialPasswordEmail } from '../../common/utils/mailer.utils';

// ─── Helper ──────────────────────────────────────────────────────────────────

const mockUserSys = (overrides: Partial<UserSys> = {}): UserSys =>
  ({
    user_sys_id: 1,
    email: 'test@example.com',
    password: 'hashed_secret',
    first_name: 'John',
    middle_name: null,
    last_name: 'Doe',
    phone: '0812345678',
    role_id: 2,
    code: 'STD001',
    edu_lev_id: 1,
    inst_id: 1,
    user_status: 'Active',
    profile_pic: null,
    flag_valid: true,
    ...overrides,
  }) as UserSys;

const buildQueryRunnerMock = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  query: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
});

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('UsersService', () => {
  let service: UsersService;
  let qrMock: ReturnType<typeof buildQueryRunnerMock>;

  const mockUserSysRepo = {
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn(),
    createQueryRunner: jest.fn(),
  };

  const mockLearningAreaService = {
    updateUserSysNormalize: jest.fn(),
  };

  const mockProgramService = {
    updateUserSysNormalize: jest.fn(),
  };

  const mockLogger: Partial<AppLogger> = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    qrMock = buildQueryRunnerMock();
    mockDataSource.createQueryRunner.mockReturnValue(qrMock);
    (generateInitialPassword as jest.Mock).mockReturnValue('Init@1234');
    (hashPassword as jest.Mock).mockResolvedValue('hashed_password');
    (sendInitialPasswordEmail as jest.Mock).mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserSys), useValue: mockUserSysRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: LearningAreaService, useValue: mockLearningAreaService },
        { provide: ProgramService, useValue: mockProgramService },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return user without password when found', async () => {
      mockUserSysRepo.findOne.mockResolvedValue(mockUserSys());

      const result = await service.findById(1);

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('password');
      expect(result.data).toHaveProperty('user_sys_id', 1);
      expect(mockUserSysRepo.findOne).toHaveBeenCalledWith({
        where: { user_sys_id: 1 },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockUserSysRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── search ────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.search({})).rejects.toThrow(BadRequestException);
    });

    it('should return users without password in results', async () => {
      mockDataSource.query.mockResolvedValue([mockUserSys()]);

      const result = await service.search({ inst_id: 1 });

      expect(result.success).toBe(true);
      result.data.forEach((u: any) => {
        expect(u).not.toHaveProperty('password');
      });
    });

    it('should filter by user_sys_id', async () => {
      mockDataSource.query.mockResolvedValue([mockUserSys()]);

      await service.search({ user_sys_id: 1 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('u.user_sys_id =');
      expect(values).toContain(1);
    });

    it('should filter by email', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ email: 'test@example.com' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('u.email =');
      expect(values).toContain('test@example.com');
    });

    it('should filter by first_name', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ first_name: 'John' });

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values).toContain('John');
    });

    it('should filter by last_name', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ last_name: 'Doe' });

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values).toContain('Doe');
    });

    it('should filter by code', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ code: 'STD001' });

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values).toContain('STD001');
    });

    it('should filter by inst_id', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('u.inst_id =');
      expect(values).toContain(1);
    });

    it('should filter by user_status', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ user_status: 'Active' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('u.user_status =');
      expect(values).toContain('Active');
    });

    it('should filter by flag_valid boolean true', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ flag_valid: true });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('u.flag_valid =');
      expect(values).toContain(true);
    });

    it('should filter by flag_valid boolean false', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ flag_valid: false });

      const [, values] = mockDataSource.query.mock.calls[0];
      expect(values).toContain(false);
    });

    it('should apply keyword ILIKE search on code, first_name, last_name, email', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ keyword: 'john' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ILIKE');
      expect(values).toContain('%john%');
    });

    it('should JOIN learning_area tables for role_id = 4', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ role_id: 4 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('user_sys_learning_area_normalize');
      expect(queryStr).toContain('learning_area');
    });

    it('should JOIN learning_area tables for role_id = 5', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ role_id: 5 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('user_sys_learning_area_normalize');
    });

    it('should filter by learning_area_id when role_id = 4', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ role_id: 4, learning_area_id: 10 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('la.learning_area_id =');
      expect(values).toContain(10);
    });

    it('should JOIN program and edu_level tables for role_id = 2', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ role_id: 2 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('user_sys_program_normalize');
      expect(queryStr).toContain('edu_level');
    });

    it('should JOIN program and edu_level tables for role_id = 3', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ role_id: 3 });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('user_sys_program_normalize');
    });

    it('should filter by program_id when role_id = 2', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ role_id: 2, program_id: 5 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('p.program_id =');
      expect(values).toContain(5);
    });

    it('should apply sort DESC order', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1, sort_by: 'first_name', sort_order: 'DESC' });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ORDER BY u.first_name DESC');
    });

    it('should default sort order to ASC', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1, sort_by: 'first_name' });

      const [queryStr] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('ASC');
    });

    it('should apply limit and offset', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.search({ inst_id: 1, limit: 20, offset: 40 });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('LIMIT');
      expect(queryStr).toContain('OFFSET');
      expect(values).toContain(20);
      expect(values).toContain(40);
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
      email: 'new@example.com',
      first_name: 'Jane',
      last_name: 'Smith',
      role_id: 2,
      code: 'STD002',
      inst_id: 1,
    };

    it('should throw BadRequestException when email is missing', async () => {
      await expect(
        service.create({ ...createDto, email: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when first_name is missing', async () => {
      await expect(
        service.create({ ...createDto, first_name: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when last_name is missing', async () => {
      await expect(
        service.create({ ...createDto, last_name: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when role_id is missing', async () => {
      await expect(
        service.create({ ...createDto, role_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when code is missing', async () => {
      await expect(
        service.create({ ...createDto, code: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when inst_id is missing', async () => {
      await expect(
        service.create({ ...createDto, inst_id: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUserSysRepo.findOne.mockResolvedValueOnce(mockUserSys());

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when code already exists in the same inst', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(mockUserSys()); // code check

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create user and return user_sys_id on success', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(null) // email not taken
        .mockResolvedValueOnce(null); // code not taken

      const createdUser = mockUserSys({ user_sys_id: 99 });
      qrMock.query.mockResolvedValueOnce([createdUser]);

      const result = await service.create(createDto);

      expect(result.success).toBe(true);
      expect(result.data).toBe(99);
      expect(result.message).toContain('created');
      expect(qrMock.connect).toHaveBeenCalled();
      expect(qrMock.startTransaction).toHaveBeenCalled();
      expect(qrMock.commitTransaction).toHaveBeenCalled();
      expect(qrMock.release).toHaveBeenCalled();
    });

    it('should insert learning_area_normalize when learning_area_id is provided', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const createdUser = mockUserSys({ user_sys_id: 10 });
      qrMock.query
        .mockResolvedValueOnce([createdUser]) // INSERT user
        .mockResolvedValueOnce([]); // INSERT normalize

      await service.create({ ...createDto, learning_area_id: 5 });

      expect(qrMock.query).toHaveBeenCalledTimes(2);
      const [normQuery, normValues] = qrMock.query.mock.calls[1];
      expect(normQuery).toContain('user_sys_learning_area_normalize');
      expect(normValues).toContain(5);
    });

    it('should insert program_normalize when program_id is provided', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const createdUser = mockUserSys({ user_sys_id: 11 });
      qrMock.query
        .mockResolvedValueOnce([createdUser]) // INSERT user
        .mockResolvedValueOnce([]); // INSERT normalize

      await service.create({ ...createDto, program_id: 7 });

      expect(qrMock.query).toHaveBeenCalledTimes(2);
      const [normQuery, normValues] = qrMock.query.mock.calls[1];
      expect(normQuery).toContain('user_sys_program_normalize');
      expect(normValues).toContain(7);
    });

    it('should rollback and throw ConflictException on DB duplicate (code 23505)', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      qrMock.query.mockRejectedValue({ code: '23505' });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(qrMock.rollbackTransaction).toHaveBeenCalled();
    });

    it('should rollback and throw InternalServerErrorException on other DB error', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      qrMock.query.mockRejectedValue(new Error('DB error'));

      await expect(service.create(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(qrMock.rollbackTransaction).toHaveBeenCalled();
      expect(qrMock.release).toHaveBeenCalled();
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockUserSysRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(999, { first_name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when email belongs to different user', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys({ user_sys_id: 1 })) // exists check
        .mockResolvedValueOnce(mockUserSys({ user_sys_id: 2 })) // email taken by another
        .mockResolvedValueOnce(null); // code check

      await expect(
        service.update(1, { email: 'other@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when code belongs to different user in same inst', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys({ user_sys_id: 1 })) // exists
        .mockResolvedValueOnce(null) // email ok
        .mockResolvedValueOnce(mockUserSys({ user_sys_id: 2 })); // code taken by another

      await expect(
        service.update(1, { code: 'TAKEN', inst_id: 1 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys()) // exists
        .mockResolvedValueOnce(null) // email
        .mockResolvedValueOnce(null); // code

      await expect(service.update(1, {})).rejects.toThrow(BadRequestException);
    });

    it('should update user fields and return success without password', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys()) // exists
        .mockResolvedValueOnce(null) // email
        .mockResolvedValueOnce(null); // code

      const updatedUser = mockUserSys({ first_name: 'Updated' });
      mockDataSource.query.mockResolvedValue([updatedUser]);

      const result = await service.update(1, { first_name: 'Updated' });

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('password');
      expect(result.message).toBeDefined();
    });

    it('should update email', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockDataSource.query.mockResolvedValue([mockUserSys({ email: 'upd@example.com' })]);

      await service.update(1, { email: 'upd@example.com' });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('email =');
      expect(values).toContain('upd@example.com');
    });

    it('should update flag_valid', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockDataSource.query.mockResolvedValue([mockUserSys({ flag_valid: false })]);

      await service.update(1, { flag_valid: false });

      const [queryStr, values] = mockDataSource.query.mock.calls[0];
      expect(queryStr).toContain('flag_valid =');
      expect(values).toContain(false);
    });

    it('should call learningAreaService.updateUserSysNormalize when learning_area_id provided', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockLearningAreaService.updateUserSysNormalize.mockResolvedValue({});

      await service.update(1, { learning_area_id: 10 });

      expect(mockLearningAreaService.updateUserSysNormalize).toHaveBeenCalledWith({
        user_sys_id: 1,
        learning_area_id: 10,
      });
    });

    it('should call programService.updateUserSysNormalize when program_id provided', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockProgramService.updateUserSysNormalize.mockResolvedValue({});

      await service.update(1, { program_id: 5 });

      expect(mockProgramService.updateUserSysNormalize).toHaveBeenCalledWith({
        user_sys_id: 1,
        program_id: 5,
      });
    });

    it('should succeed with only learning_area_id (no user_sys table fields)', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockLearningAreaService.updateUserSysNormalize.mockResolvedValue({});

      const result = await service.update(1, { learning_area_id: 3 });

      expect(result.success).toBe(true);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on DB duplicate (code 23505)', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockDataSource.query.mockRejectedValue({ code: '23505' });

      await expect(
        service.update(1, { email: 'dup@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on other update error', async () => {
      mockUserSysRepo.findOne
        .mockResolvedValueOnce(mockUserSys())
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockDataSource.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.update(1, { first_name: 'err' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      mockUserSysRepo.findOne.mockResolvedValue(null);

      await expect(service.delete(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete user and return data without password', async () => {
      mockUserSysRepo.findOne.mockResolvedValue(mockUserSys());
      mockUserSysRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete(1);

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('password');
      expect(result.message).toBeDefined();
      expect(mockUserSysRepo.delete).toHaveBeenCalledWith({ user_sys_id: 1 });
    });

    it('should throw InternalServerErrorException on delete error', async () => {
      mockUserSysRepo.findOne.mockResolvedValue(mockUserSys());
      mockUserSysRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.delete(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
