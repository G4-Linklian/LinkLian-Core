import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthService } from './auth.service';
import { UserSys } from '../users/entities/user-sys.entity';
import { AppLogger } from '../../common/logger/app-logger.service';

import * as authUtil from '../../common/utils/auth.util';
import * as mailerUtil from '../../common/utils/mailer.utils';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../common/utils/auth.util', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateJwtToken: jest.fn(),
  verifyJwtToken: jest.fn(),
  generateInitialPassword: jest.fn(),
}));

jest.mock('../../common/utils/mailer.utils', () => ({
  sendOTPEmail: jest.fn(),
  sendTempPasswordEmail: jest.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockUser = (overrides: Partial<UserSys> = {}): UserSys =>
  ({
    user_sys_id: 1,
    email: 'test@example.com',
    password: 'hashed_password',
    role_id: 4,
    inst_id: 1,
    flag_valid: true,
    ...overrides,
  }) as UserSys;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<Repository<UserSys>>;

  const mockLogger: Partial<AppLogger> = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserSys),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
            query: jest.fn(),
          },
        },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(UserSys));

    // Default mock returns
    (authUtil.verifyPassword as jest.Mock).mockResolvedValue(true);
    (authUtil.generateJwtToken as jest.Mock).mockReturnValue('mock.jwt.token');
    (authUtil.verifyJwtToken as jest.Mock).mockReturnValue({
      user_id: '1',
      username: 'test@example.com',
      role_id: '4',
      inst_id: '1',
      role_name: 'teacher',
      access: {},
      otp_verified: true,
    });
    (authUtil.hashPassword as jest.Mock).mockResolvedValue('new_hashed');
    (authUtil.generateInitialPassword as jest.Mock).mockReturnValue('Temp@1234');
    (mailerUtil.sendOTPEmail as jest.Mock).mockResolvedValue(undefined);
    (mailerUtil.sendTempPasswordEmail as jest.Mock).mockResolvedValue(undefined);
    userRepo.query.mockResolvedValue([{ role_name: 'teacher', access: {} }]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  describe('onModuleInit / onModuleDestroy', () => {
    it('should start cleanup interval on init', () => {
      jest.useFakeTimers();
      service.onModuleInit();
      expect(setInterval).toBeDefined();
      jest.useRealTimers();
    });

    it('should clear interval on destroy', () => {
      jest.useFakeTimers();
      service.onModuleInit();
      expect(() => service.onModuleDestroy()).not.toThrow();
      jest.useRealTimers();
    });
  });

  // ─── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    const loginDto = {
      username: 'test@example.com',
      password: 'password123',
    };

    it('should throw UnauthorizedException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for role mismatch with user_group', async () => {
      userRepo.findOne.mockResolvedValue(mockUser({ role_id: 4 }));

      await expect(
        service.login({ ...loginDto, user_group: 'student' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for unknown user_group value', async () => {
      userRepo.findOne.mockResolvedValue(mockUser({ role_id: 4 }));

      await expect(
        service.login({ ...loginDto, user_group: 'admin_xyz' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      (authUtil.verifyPassword as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return require_reset_password when flag_valid is false', async () => {
      userRepo.findOne.mockResolvedValue(mockUser({ flag_valid: false }));

      const result = await service.login(loginDto);

      expect(result).toMatchObject({
        success: true,
        require_reset_password: true,
      });
    });

    it('should skip OTP and return token when user already has valid authorization token', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());

      const result = await service.login(loginDto, 'Bearer mock.jwt.token');

      expect(result).toMatchObject({
        success: true,
        message: 'Login successful',
        access_token: 'mock.jwt.token',
      });
      expect(mailerUtil.sendOTPEmail).not.toHaveBeenCalled();
    });

    it('should send OTP and return session when no valid token present', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      (authUtil.verifyJwtToken as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });

      const result = (await service.login(loginDto)) as any;

      expect(result).toMatchObject({
        success: true,
        otp_session_id: expect.any(String),
        otp_expires_at: expect.any(String),
      });
      expect(mailerUtil.sendOTPEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });

    it('should still return OTP response even if email sending fails', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      (authUtil.verifyJwtToken as jest.Mock).mockImplementation(() => {
        throw new Error('invalid');
      });
      (mailerUtil.sendOTPEmail as jest.Mock).mockRejectedValue(
        new Error('SMTP error'),
      );

      const result = (await service.login(loginDto)) as any;

      expect(result).toMatchObject({ success: true, otp_session_id: expect.any(String) });
    });
  });

  // ─── verifyOTP ──────────────────────────────────────────────────────────────

  describe('verifyOTP', () => {
    /** Helper: create a real OTP session via login flow */
    const setupOTPSession = async (): Promise<{
      sessionId: string;
      otp: string;
    }> => {
      userRepo.findOne.mockResolvedValue(mockUser());
      (authUtil.verifyJwtToken as jest.Mock).mockImplementation(() => {
        throw new Error('no token');
      });

      let capturedOtp = '';
      (mailerUtil.sendOTPEmail as jest.Mock).mockImplementation(
        (_email: string, sentOtp: string) => {
          capturedOtp = sentOtp;
          return Promise.resolve();
        },
      );

      const loginResult = (await service.login({
        username: 'test@example.com',
        password: 'password123',
      })) as any;

      return { sessionId: loginResult.otp_session_id, otp: capturedOtp };
    };

    it('should throw UnauthorizedException for invalid session id', async () => {
      await expect(
        service.verifyOTP({
          otp: '123456',
          otp_session_id: 'non-existent-session',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong OTP', async () => {
      const { sessionId } = await setupOTPSession();
      userRepo.findOne.mockResolvedValue(mockUser());

      await expect(
        service.verifyOTP({ otp: '000000', otp_session_id: sessionId }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when user not found during verify', async () => {
      const { sessionId, otp } = await setupOTPSession();
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyOTP({ otp, otp_session_id: sessionId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return token on successful OTP verification', async () => {
      const { sessionId, otp } = await setupOTPSession();
      userRepo.findOne.mockResolvedValue(mockUser());

      const result = await service.verifyOTP({
        otp,
        otp_session_id: sessionId,
      });

      expect(result).toMatchObject({
        success: true,
        message: 'Login successful',
        access_token: 'mock.jwt.token',
        user_id: 1,
      });
    });

    it('should delete session after successful verification', async () => {
      const { sessionId, otp } = await setupOTPSession();
      userRepo.findOne.mockResolvedValue(mockUser());

      await service.verifyOTP({ otp, otp_session_id: sessionId });

      // Verifying same OTP again should fail
      await expect(
        service.verifyOTP({ otp, otp_session_id: sessionId }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── resendOTP ──────────────────────────────────────────────────────────────

  describe('resendOTP', () => {
    it('should throw UnauthorizedException when session does not exist', async () => {
      await expect(
        service.resendOTP({ otp_session_id: 'invalid-id' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw NotFoundException when user not found during resend', async () => {
      // Create session via login
      userRepo.findOne.mockResolvedValue(mockUser());
      (authUtil.verifyJwtToken as jest.Mock).mockImplementation(() => {
        throw new Error('no token');
      });

      const loginResult = (await service.login({
        username: 'test@example.com',
        password: 'password123',
      })) as any;

      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.resendOTP({ otp_session_id: loginResult.otp_session_id }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a new session and send email on resend', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      (authUtil.verifyJwtToken as jest.Mock).mockImplementation(() => {
        throw new Error('no token');
      });

      const loginResult = (await service.login({
        username: 'test@example.com',
        password: 'password123',
      })) as any;

      (mailerUtil.sendOTPEmail as jest.Mock).mockClear();
      userRepo.findOne.mockResolvedValue(mockUser());

      const resendResult = await service.resendOTP({
        otp_session_id: loginResult.otp_session_id,
      });

      expect(resendResult).toMatchObject({
        success: true,
        otp_session_id: expect.any(String),
      });
      // new session id should differ from original
      expect(resendResult.otp_session_id).not.toBe(loginResult.otp_session_id);
      expect(mailerUtil.sendOTPEmail).toHaveBeenCalledTimes(1);
    });

    it('should still return response even if resend email fails', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      (authUtil.verifyJwtToken as jest.Mock).mockImplementation(() => {
        throw new Error('no token');
      });

      const loginResult = (await service.login({
        username: 'test@example.com',
        password: 'password123',
      })) as any;

      userRepo.findOne.mockResolvedValue(mockUser());
      (mailerUtil.sendOTPEmail as jest.Mock).mockRejectedValue(
        new Error('SMTP error'),
      );

      const result = await service.resendOTP({
        otp_session_id: loginResult.otp_session_id,
      });

      expect(result).toMatchObject({ success: true });
    });
  });

  // ─── verifyToken ────────────────────────────────────────────────────────────

  describe('verifyToken', () => {
    it('should throw UnauthorizedException when token is invalid/expired', async () => {
      (authUtil.verifyJwtToken as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.verifyToken('bad.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user in token not found in DB', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyToken('valid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user data on valid token', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());

      const result = await service.verifyToken('valid.token');

      expect(result).toMatchObject({
        success: true,
        message: 'Token is valid',
        data: {
          user_id: 1,
          username: 'test@example.com',
        },
      });
    });
  });

  // ─── resetPassword ──────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    const baseDto = {
      email: 'test@example.com',
      password: 'OldPass@1',
      new_password: 'NewPass@1',
      confirm_password: 'NewPass@1',
    };

    it('should throw BadRequestException when new_password != confirm_password', async () => {
      await expect(
        service.resetPassword({ ...baseDto, confirm_password: 'Different@1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when new_password is too short', async () => {
      await expect(
        service.resetPassword({
          ...baseDto,
          new_password: 'Short',
          confirm_password: 'Short',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when email not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.resetPassword(baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      (authUtil.verifyPassword as jest.Mock).mockResolvedValue(false);

      await expect(service.resetPassword(baseDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should update password and set flag_valid=true on success', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.resetPassword(baseDto);

      expect(authUtil.hashPassword).toHaveBeenCalledWith(baseDto.new_password);
      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ flag_valid: true }),
      );
      expect(result).toMatchObject({ success: true });
    });
  });

  // ─── forgotPassword ─────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should throw NotFoundException when email not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.forgotPassword({ email: 'notfound@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set flag_valid=false and send temp password email', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ flag_valid: false }),
      );
      expect(mailerUtil.sendTempPasswordEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Temp@1234',
      );
      expect(result).toMatchObject({ success: true });
    });

    it('should still return success even if sending temp password email fails', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      userRepo.update.mockResolvedValue({ affected: 1 } as any);
      (mailerUtil.sendTempPasswordEmail as jest.Mock).mockRejectedValue(
        new Error('SMTP error'),
      );

      const result = await service.forgotPassword({
        email: 'test@example.com',
      });

      expect(result).toMatchObject({ success: true });
    });
  });
});
