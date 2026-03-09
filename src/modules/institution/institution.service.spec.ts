import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { InstitutionService } from './institution.service';
import { Institution } from './entities/institution.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

import * as authUtil from '../../common/utils/auth.util';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../common/utils/auth.util', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateJwtToken: jest.fn(),
  generateInitialPassword: jest.fn(),
}));

jest.mock('../../common/utils/mailer.utils', () => ({
  sendInitialPasswordEmail: jest.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockInstitution = (overrides: Partial<Institution> = {}): Institution =>
  ({
    inst_id: 1,
    inst_email: 'school@example.com',
    inst_password: 'hashed_password',
    inst_name_th: 'โรงเรียนตัวอย่าง',
    inst_name_en: 'Example School',
    inst_abbr_th: 'รร.ตย.',
    inst_abbr_en: 'ES',
    inst_type: 'high school',
    inst_phone: '021234567',
    website: 'https://example.com',
    address: '123 Main St',
    subdistrict: 'Bang Rak',
    district: 'Bang Rak',
    province: 'Bangkok',
    postal_code: '10500',
    logo_url: null,
    docs_url: null,
    approve_status: 'approved',
    flag_valid: true,
    ...overrides,
  }) as Institution;

// ─── QueryBuilder mock factory ────────────────────────────────────────────────

const buildQbMock = (rawResult: any) => {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(rawResult),
    getRawMany: jest.fn().mockResolvedValue(rawResult),
  };
  return qb;
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('InstitutionService', () => {
  let service: InstitutionService;

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
        InstitutionService,
        { provide: getRepositoryToken(Institution), useValue: mockRepo },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<InstitutionService>(InstitutionService);

    (authUtil.hashPassword as jest.Mock).mockResolvedValue('hashed_password');
    (authUtil.verifyPassword as jest.Mock).mockResolvedValue(true);
    (authUtil.generateJwtToken as jest.Mock).mockReturnValue('mock.jwt.token');
    (authUtil.generateInitialPassword as jest.Mock).mockReturnValue('InitPass@123');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should throw NotFoundException when institution does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });

    it('should return institution data without password', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());

      const result = await service.findById(1);

      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('inst_password');
    });

    it('should call findOne with correct id', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());

      await service.findById(1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { inst_id: 1 } });
    });
  });

  // ─── findDetailById ────────────────────────────────────────────────────────

  describe('findDetailById', () => {
    it('should throw BadRequestException when id is 0 or falsy', async () => {
      await expect(service.findDetailById(0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when no result from query builder', async () => {
      const qb = buildQbMock(undefined);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findDetailById(1)).rejects.toThrow(NotFoundException);
    });

    it('should return detail data on success', async () => {
      const detail = {
        inst_id: 1,
        inst_email: 'school@example.com',
        student_count: '10',
        teacher_count: '5',
        open_semester: '1',
      };
      const qb = buildQbMock(detail);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findDetailById(1);

      expect(result).toEqual({ success: true, data: detail });
    });

    it('should throw InternalServerErrorException on unexpected DB error', async () => {
      const qb = buildQbMock(null);
      qb.getRawOne = jest.fn().mockRejectedValue(new Error('DB error'));
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findDetailById(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── searchInstitution ─────────────────────────────────────────────────────

  describe('searchInstitution', () => {
    it('should throw BadRequestException when no filter is provided', async () => {
      await expect(service.searchInstitution({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return results when searching by inst_id', async () => {
      const qb = buildQbMock([mockInstitution()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchInstitution({ inst_id: 1 });

      expect(result).toEqual({ success: true, data: [mockInstitution()] });
    });

    it('should return results when searching by inst_email', async () => {
      const qb = buildQbMock([mockInstitution()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchInstitution({
        inst_email: 'school@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by inst_type', async () => {
      const qb = buildQbMock([mockInstitution()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchInstitution({ inst_type: 'high school' });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by approve_status', async () => {
      const qb = buildQbMock([mockInstitution()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchInstitution({
        approve_status: 'approved',
      });

      expect(result.success).toBe(true);
    });

    it('should return results when searching by flag_valid', async () => {
      const qb = buildQbMock([mockInstitution()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchInstitution({ flag_valid: true });

      expect(result.success).toBe(true);
    });

    it('should apply from=admin filter (approve_status bracket)', async () => {
      const qb = buildQbMock([mockInstitution()]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.searchInstitution({ from: 'admin' });

      expect(result.success).toBe(true);
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should apply sort and pagination', async () => {
      const qb = buildQbMock([]);
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await service.searchInstitution({
        inst_id: 1,
        sort_by: 'inst_name_th',
        sort_order: 'DESC',
        limit: 10,
        offset: 5,
      });

      expect(qb.orderBy).toHaveBeenCalledWith('i.inst_name_th', 'DESC');
      expect(qb.limit).toHaveBeenCalledWith(10);
      expect(qb.offset).toHaveBeenCalledWith(5);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      const qb = buildQbMock(null);
      qb.getRawMany = jest.fn().mockRejectedValue(new Error('DB error'));
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.searchInstitution({ inst_id: 1 }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── createInstitution ─────────────────────────────────────────────────────

  describe('createInstitution', () => {
    const createDto = {
      inst_email: 'new@example.com',
      inst_password: 'Password@1',
      inst_name_th: 'โรงเรียนใหม่',
      inst_type: 'high school',
    };

    it('should throw ConflictException when email already exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());

      await expect(service.createInstitution(createDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create institution and return success', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const created = mockInstitution();
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await service.createInstitution(createDto as any);

      expect(result).toMatchObject({
        success: true,
        message: 'Institution created successfully!',
      });
      expect(authUtil.hashPassword).toHaveBeenCalledWith('InitPass@123');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ approve_status: 'pending' }),
      );
    });

    it('should throw ConflictException on duplicate key (code 23505)', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockInstitution());
      const dbError = Object.assign(new Error('duplicate'), { code: '23505' });
      mockRepo.save.mockRejectedValue(dbError);

      await expect(service.createInstitution(createDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException on other DB error', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockInstitution());
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.createInstitution(createDto as any)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── updateInstitution ─────────────────────────────────────────────────────

  describe('updateInstitution', () => {
    it('should throw NotFoundException when institution does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateInstitution(999, { inst_name_th: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no fields are provided', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());

      await expect(service.updateInstitution(1, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update institution and return success', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateInstitution(1, {
        inst_name_th: 'Updated School',
      });

      expect(result).toMatchObject({
        success: true,
        message: 'Institution updated successfully!',
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        { inst_id: 1 },
        expect.objectContaining({ inst_name_th: 'Updated School' }),
      );
    });

    it('should ignore null/undefined fields when building update object', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());
      mockRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateInstitution(1, {
        inst_name_th: 'Updated',
        inst_name_en: undefined,
        inst_phone: null as any,
      });

      expect(mockRepo.update).toHaveBeenCalledWith(
        { inst_id: 1 },
        expect.not.objectContaining({ inst_phone: null }),
      );
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());
      mockRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(
        service.updateInstitution(1, { inst_name_th: 'Updated' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── deleteInstitution ─────────────────────────────────────────────────────

  describe('deleteInstitution', () => {
    it('should throw NotFoundException when institution does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteInstitution(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete institution and return success', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteInstitution(1);

      expect(result).toMatchObject({
        success: true,
        message: 'Institution deleted successfully!',
      });
      expect(mockRepo.delete).toHaveBeenCalledWith({ inst_id: 1 });
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());
      mockRepo.delete.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteInstitution(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ─── loginInstitution ──────────────────────────────────────────────────────

  describe('loginInstitution', () => {
    const loginDto = {
      inst_email: 'school@example.com',
      inst_password: 'Password@1',
    };

    it('should throw BadRequestException when email or password is missing', async () => {
      await expect(
        service.loginInstitution({ inst_email: '', inst_password: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when institution not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.loginInstitution(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());
      (authUtil.verifyPassword as jest.Mock).mockResolvedValue(false);

      await expect(service.loginInstitution(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return token and institution email on success', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());

      const result = await service.loginInstitution(loginDto);

      expect(result).toMatchObject({
        success: true,
        message: 'Login successful',
        token: 'mock.jwt.token',
        institution: 'school@example.com',
      });
      expect(authUtil.generateJwtToken).toHaveBeenCalled();
    });

    it('should not include inst_password in token payload', async () => {
      mockRepo.findOne.mockResolvedValue(mockInstitution());

      await service.loginInstitution(loginDto);

      const tokenPayload = (authUtil.generateJwtToken as jest.Mock).mock
        .calls[0][0];
      expect(tokenPayload.institution).not.toHaveProperty('inst_password');
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockRepo.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.loginInstitution(loginDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});