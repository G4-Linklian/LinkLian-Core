import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RoleService } from './role.service';
import { Role } from './entities/role.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockRole = (overrides: Partial<Role> = {}): Role =>
  ({
    role_id: 1,
    role_name: 'admin',
    role_type: 'system',
    access: { read: true, write: true },
    flag_valid: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    ...overrides,
  }) as Role;

// ─── QueryBuilder mock factory ────────────────────────────────────────────────

const buildQbMock = (getRawManyResult: any = []) => {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(getRawManyResult),
  };
  return qb;
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('RoleService', () => {
  let service: RoleService;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
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
        RoleService,
        { provide: getRepositoryToken(Role), useValue: mockRepo },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return the role when found', async () => {
      mockRepo.findOne.mockResolvedValue(mockRole());

      const result = await service.findById(1);

      expect(result).toEqual(mockRole());
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { role_id: 1 } });
    });

    it('should throw NotFoundException when role does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── searchRole ────────────────────────────────────────────────────────────

  describe('searchRole', () => {
    it('should return raw results with no filters', async () => {
      const qb = buildQbMock([mockRole()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchRole({});

      expect(result).toEqual([mockRole()]);
      expect(qb.getRawMany).toHaveBeenCalled();
    });

    it('should apply role_id filter', async () => {
      const qb = buildQbMock([mockRole()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ role_id: 1 });

      expect(qb.andWhere).toHaveBeenCalledWith('r.role_id = :roleId', {
        roleId: 1,
      });
    });

    it('should apply role_name filter', async () => {
      const qb = buildQbMock([mockRole()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ role_name: 'admin' });

      expect(qb.andWhere).toHaveBeenCalledWith('r.role_name = :roleName', {
        roleName: 'admin',
      });
    });

    it('should apply role_type filter', async () => {
      const qb = buildQbMock([mockRole()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ role_type: 'system' });

      expect(qb.andWhere).toHaveBeenCalledWith('r.role_type = :roleType', {
        roleType: 'system',
      });
    });

    it('should apply access filter', async () => {
      const access = { read: true };
      const qb = buildQbMock([mockRole()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ access });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'r.access @> :access::jsonb',
        { access: JSON.stringify(access) },
      );
    });

    it('should apply flag_valid filter when true', async () => {
      const qb = buildQbMock([mockRole()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ flag_valid: true });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'r.flag_valid = :flagValid',
        { flagValid: true },
      );
    });

    it('should apply flag_valid filter when false', async () => {
      const qb = buildQbMock([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ flag_valid: false });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'r.flag_valid = :flagValid',
        { flagValid: false },
      );
    });

    it('should apply sort ASC', async () => {
      const qb = buildQbMock([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ sort_by: 'role_name', sort_order: 'ASC' });

      expect(qb.orderBy).toHaveBeenCalledWith('r.role_name', 'ASC');
    });

    it('should apply sort DESC', async () => {
      const qb = buildQbMock([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ sort_by: 'role_name', sort_order: 'DESC' });

      expect(qb.orderBy).toHaveBeenCalledWith('r.role_name', 'DESC');
    });

    it('should default sort to ASC when sort_order is not DESC', async () => {
      const qb = buildQbMock([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ sort_by: 'role_name' });

      expect(qb.orderBy).toHaveBeenCalledWith('r.role_name', 'ASC');
    });

    it('should apply limit and offset', async () => {
      const qb = buildQbMock([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchRole({ limit: 10, offset: 5 });

      expect(qb.limit).toHaveBeenCalledWith(10);
      expect(qb.offset).toHaveBeenCalledWith(5);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      const qb = buildQbMock();
      qb.getRawMany.mockRejectedValue(new Error('DB error'));
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.searchRole({})).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── createRole ────────────────────────────────────────────────────────────

  describe('createRole', () => {
    const createDto = {
      role_name: 'admin',
      role_type: 'system',
      access: { read: true, write: true },
    };

    it('should create a role and return success message with data', async () => {
      const created = mockRole();
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.createRole(createDto);

      expect(result).toMatchObject({
        message: 'Role created successfully!',
        data: created,
      });
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role_name: 'admin', role_type: 'system' }),
      );
      expect(mockRepo.save).toHaveBeenCalledWith(created);
    });

    it('should default flag_valid to true when not provided', async () => {
      const created = mockRole();
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      await service.createRole(createDto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ flag_valid: true }),
      );
    });

    it('should respect flag_valid when explicitly set to false', async () => {
      const created = mockRole({ flag_valid: false });
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      await service.createRole({ ...createDto, access: { read: true, write: true }, flag_valid: false });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ flag_valid: false }),
      );
    });

    it('should throw InternalServerErrorException on save error', async () => {
      mockRepo.create.mockReturnValue(mockRole());
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createRole(createDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── updateRole ────────────────────────────────────────────────────────────

  describe('updateRole', () => {
    it('should throw NotFoundException when role does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateRole(999, { role_name: 'new name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no valid fields provided', async () => {
      mockRepo.findOne.mockResolvedValue(mockRole());

      await expect(service.updateRole(1, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update role and return updated data', async () => {
      const updated = mockRole({ role_name: 'superadmin' });
      mockRepo.findOne
        .mockResolvedValueOnce(mockRole())
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateRole(1, { role_name: 'superadmin' });

      expect(result).toMatchObject({
        message: 'Role updated successfully!',
        data: updated,
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        { role_id: 1 },
        expect.objectContaining({ role_name: 'superadmin' }),
      );
    });

    it('should update role_type', async () => {
      const updated = mockRole({ role_type: 'user' });
      mockRepo.findOne
        .mockResolvedValueOnce(mockRole())
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateRole(1, { role_type: 'user' });

      expect(result.data!.role_type).toBe('user');
    });

    it('should update access', async () => {
      const newAccess = { read: true, write: false };
      const updated = mockRole({ access: newAccess });
      mockRepo.findOne
        .mockResolvedValueOnce(mockRole())
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateRole(1, { access: newAccess });

      expect(result.data!.access).toEqual(newAccess);
    });

    it('should update flag_valid', async () => {
      const updated = mockRole({ flag_valid: false });
      mockRepo.findOne
        .mockResolvedValueOnce(mockRole())
        .mockResolvedValueOnce(updated);
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateRole(1, { flag_valid: false });

      expect(result.data!.flag_valid).toBe(false);
    });

    it('should ignore null/undefined fields and not include them in update', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(mockRole())
        .mockResolvedValueOnce(mockRole());
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateRole(1, {
        role_name: 'valid',
        role_type: undefined,
      } as any);

      expect(mockRepo.update).toHaveBeenCalledWith(
        { role_id: 1 },
        { role_name: 'valid' },
      );
    });

    it('should throw InternalServerErrorException on update error', async () => {
      mockRepo.findOne.mockResolvedValue(mockRole());
      mockRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateRole(1, { role_name: 'error' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── deleteRole ────────────────────────────────────────────────────────────

  describe('deleteRole', () => {
    it('should throw NotFoundException when role does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteRole(999)).rejects.toThrow(NotFoundException);
    });

    it('should delete role and return success message', async () => {
      mockRepo.findOne.mockResolvedValue(mockRole());
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteRole(1);

      expect(result).toEqual({ message: 'Role deleted successfully!' });
      expect(mockRepo.delete).toHaveBeenCalledWith({ role_id: 1 });
    });

    it('should throw InternalServerErrorException on delete error', async () => {
      mockRepo.findOne.mockResolvedValue(mockRole());
      mockRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteRole(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
