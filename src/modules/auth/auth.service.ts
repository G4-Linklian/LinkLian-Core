import { 
  Injectable, 
  UnauthorizedException, 
  BadRequestException,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { UserSys } from '../users/entities/user-sys.entity';
import { 
  hashPassword, 
  verifyPassword, 
  generateJwtToken, 
  verifyJwtToken 
} from '../../common/utils/auth.util';
import { generateInitialPassword } from '../../common/utils/auth.util';
import { sendOTPEmail, sendTempPasswordEmail, sendInitialPasswordEmail } from '../../common/utils/mailer.utils';

import { 
  LoginDto, 
  VerifyOTPDto, 
  ResendOTPDto, 
  ResetPasswordDto, 
  ForgotPasswordDto,
  RegisterDto
} from './dto/auth.dto';

import { 
  IOTPSession, 
  ILoginResponse, 
  IVerifyResponse,
  ITokenPayload 
} from './interfaces/auth.interface';

// User group to role mapping (ต้องใช้ role_id แทน role_name)
const USER_GROUP_ROLE_MAP: Record<string, number[]> = {
  student: [2, 3], // high school student, uni student role IDs
  teacher: [4, 5], // teacher, instructor role IDs
};

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly otpSessions: Map<string, IOTPSession>;
  private cleanupInterval?: NodeJS.Timeout;
  
  private readonly OTP_EXPIRY_MS = 5 * 60 * 1000;
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  private readonly TOKEN_SHORT_EXPIRY = '15d';
  private readonly TOKEN_LONG_EXPIRY = '30d';
  private readonly MIN_PASSWORD_LENGTH = 8;

  constructor(
    @InjectRepository(UserSys)
    private readonly userRepo: Repository<UserSys>,
  ) {
    this.otpSessions = new Map<string, IOTPSession>();
  }

  onModuleInit() {
    this.startCleanupInterval();
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL_MS);
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.otpSessions.entries()) {
      if (now > session.expiresAt) {
        this.otpSessions.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [AUTH] Cleaned up ${cleaned} expired OTP sessions`);
    }
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private createOTPSession(
    user: UserSys, 
    rememberMe: boolean = false
  ): { sessionId: string; otp: string; expiresAt: number } {
    const otp = this.generateOTP();
    const sessionId = randomUUID();
    const expiresAt = Date.now() + this.OTP_EXPIRY_MS;

    this.otpSessions.set(sessionId, {
      otp,
      email: String(user.email),
      userId: user.user_sys_id,
      expiresAt,
      used: false,
      rememberMe,
    });

    return { sessionId, otp, expiresAt };
  }

  private getOTPSession(sessionId: string): IOTPSession | undefined {
    return this.otpSessions.get(sessionId);
  }

  private deleteOTPSession(sessionId: string): void {
    this.otpSessions.delete(sessionId);
  }

  private validateOTPSession(sessionId: string, otp: string): IOTPSession {
    const session = this.getOTPSession(sessionId);

    if (!session) {
      throw new UnauthorizedException('OTP session expired or invalid');
    }

    if (session.used) {
      throw new BadRequestException('OTP already used');
    }

    if (Date.now() > session.expiresAt) {
      this.deleteOTPSession(sessionId);
      throw new UnauthorizedException('OTP expired');
    }

    if (session.otp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    return session;
  }

  private verifyOptionalToken(authorization?: string): ITokenPayload | null {
    if (!authorization) return null;

    const token = authorization.replace('Bearer ', '');
    try {
      return verifyJwtToken(token) as ITokenPayload;
    } catch {
      return null;
    }
  }

  private async generateUserToken(user: UserSys, rememberMe: boolean = false): Promise<string> {
    const expiresIn = rememberMe ? this.TOKEN_LONG_EXPIRY : this.TOKEN_SHORT_EXPIRY;
    
    // ดึง role_name และ access จาก database
    let roleName = '';
    let access = {};
    if (user.role_id) {
      try {
        const roleResult = await this.userRepo.query(
          'SELECT role_name, access FROM role WHERE role_id = $1',
          [user.role_id]
        );
        if (roleResult.length > 0) {
          roleName = roleResult[0].role_name;
          access = roleResult[0].access || {};
        }
      } catch (error) {
        console.error('Failed to fetch role_name and access:', error);
      }
    }
    
    const payload: ITokenPayload = {
      user_id: user.user_sys_id.toString(),
      username: String(user.email),
      role_id: user.role_id?.toString() || '',
      inst_id: user.inst_id?.toString() || '',
      role_name: roleName,
      access: access,
      otp_verified: true,
    };

    return generateJwtToken(payload, expiresIn);
  }

  private hasValidToken(authorization: string | undefined, userId: number): boolean {
    const decoded = this.verifyOptionalToken(authorization);
    return decoded !== null && decoded.user_id === userId.toString();
  }

  private validateUserGroup(userGroup: string | undefined, roleId: number): void {
    if (!userGroup) return;

    const allowedRoleIds = USER_GROUP_ROLE_MAP[userGroup];
    if (!allowedRoleIds) {
      throw new BadRequestException('Invalid user group');
    }

    if (!allowedRoleIds.includes(roleId)) {
      throw new UnauthorizedException('Role mismatch');
    }
  }

  private async findUserByEmail(email: string): Promise<UserSys> {
      console.log('🔍 [DEBUG] Finding user by email:', email);
    const user = await this.userRepo.findOne({
      where: { email },
    });

    if (!user) {
        console.log('❌ [DEBUG] User not found in database');
      throw new UnauthorizedException('Invalid credentials');
    }
    console.log('✅ [DEBUG] User found:', {
    user_sys_id: user.user_sys_id,
    email: user.email,
    role_id: user.role_id,
    has_password: !!user.password
  });

    return user;
  }

  private async verifyUserPassword(user: UserSys, password: string): Promise<void> {
    console.log('🔍 [DEBUG] Password verification:', {
    user_email: String(user.email),
    password_length: password.length,
    stored_password_prefix: String(user.password).substring(0, 10) + '...'
  });
    
    const isValid = await verifyPassword(password, String(user.password));
    console.log('🔍 [DEBUG] Password verification result:', isValid);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  private async createLoginResponse(user: UserSys, token: string): Promise<IVerifyResponse> {
    // ดึง role_name จาก database
    let roleName = '';
    if (user.role_id) {
      try {
        const roleResult = await this.userRepo.query(
          'SELECT role_name FROM role WHERE role_id = $1',
          [user.role_id]
        );
        if (roleResult.length > 0) {
          roleName = roleResult[0].role_name;
        }
      } catch (error) {
        console.error('Failed to fetch role_name:', error);
      }
    }

    return {
      success: true,
      message: 'Login successful',
      access_token: token,
      user_id: user.user_sys_id,
      role_name: roleName,
      inst_id: user.inst_id || 0,
    };
  }

  private createOTPResponse(
    sessionId: string, 
    expiresAt: number, 
    otp?: string
  ): ILoginResponse {
    return {
      success: true,
      message: 'OTP sent to your email',
      otp_session_id: sessionId,
      otp_expires_at: new Date(expiresAt).toISOString(),
      ...(process.env.NODE_ENV === 'development' && otp && { _dev_otp: otp }),
    };
  }


  async login(dto: LoginDto, authorization?: string): Promise<ILoginResponse | IVerifyResponse> {
    const { username, password, user_group, remember_me = false } = dto;

    const user = await this.findUserByEmail(username);
    this.validateUserGroup(user_group, Number(user.role_id));
    await this.verifyUserPassword(user, password);

    // ✅ ตรวจสอบ flag_valid - ถ้า false ต้อง reset password ก่อน
    if (user.flag_valid === false) {
      console.log('🔑 [AUTH] flag_valid is false - require password reset');
      return {
        success: true,
        message: 'Please reset your password',
        user_id: user.user_sys_id,
        require_reset_password: true,
      };
    }

    // ✅ Check if user has valid token (skip OTP)
    if (this.hasValidToken(authorization, user.user_sys_id)) {
      const token = await this.generateUserToken(user, remember_me);
      console.log('✅ [AUTH] Valid token found - skip OTP');
      return this.createLoginResponse(user, token);
    }

    // ✅ Generate and send OTP
    const { sessionId, otp, expiresAt } = this.createOTPSession(user, remember_me);
    
    console.log(`📧 [AUTH] OTP for ${user.email}: ${otp}`);

    // 🔥 ส่งอีเมล OTP
    try {
      console.log('📧 [AUTH] Attempting to send OTP email...');
      await sendOTPEmail(String(user.email), otp);
    } catch (error) {
      console.error('❌ [AUTH] Failed to send OTP email:', error);
    }

    return this.createOTPResponse(sessionId, expiresAt, otp);
  }

  async verifyOTP(dto: VerifyOTPDto): Promise<IVerifyResponse> {
    const { otp, otp_session_id, remember_me } = dto;

    const session = this.validateOTPSession(otp_session_id, otp);

    const user = await this.userRepo.findOne({
      where: { user_sys_id: session.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const shouldRemember = remember_me ?? session.rememberMe ?? false;
    const token = await this.generateUserToken(user, shouldRemember);

    this.deleteOTPSession(otp_session_id);

    return this.createLoginResponse(user, token);
  }

  async resendOTP(dto: ResendOTPDto): Promise<ILoginResponse> {
    const { otp_session_id } = dto;

    const oldSession = this.getOTPSession(otp_session_id);
    if (!oldSession) {
      throw new UnauthorizedException('OTP session expired');
    }

    const user = await this.userRepo.findOne({
      where: { user_sys_id: oldSession.userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.deleteOTPSession(otp_session_id);

    const { sessionId, otp, expiresAt } = this.createOTPSession(user, oldSession.rememberMe);

    console.log(`📧 [AUTH] New OTP for ${oldSession.email}: ${otp}`);

    // 🔥 ส่งอีเมล OTP ใหม่
    try {
      console.log('📧 [AUTH] Attempting to send OTP email...');
      await sendOTPEmail(String(user.email), otp);
      console.log('✅ [AUTH] OTP email sent successfully');
    } catch (error) {
      console.error('❌ [AUTH] Failed to send OTP email:', error);
    }

    return this.createOTPResponse(sessionId, expiresAt, otp);
  }

  async verifyToken(token: string) {
    try {
      const decoded = verifyJwtToken(token) as ITokenPayload;

      const user = await this.userRepo.findOne({
        where: { user_sys_id: parseInt(decoded.user_id) },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return {
        success: true,
        message: 'Token is valid',
        data: {
          user_id: user.user_sys_id,
          username: user.email,
          role_id: user.role_id,
          role_name: '',
          inst_id: user.inst_id || 0,
          otp_verified: true,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { email, password, new_password, confirm_password } = dto;

    if (new_password !== confirm_password) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    if (new_password.length < this.MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `New password must be at least ${this.MIN_PASSWORD_LENGTH} characters`
      );
    }

    const user = await this.userRepo.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password (initial password)
    await this.verifyUserPassword(user, password);

    // Hash new password
    const hashedPassword = await hashPassword(new_password);
    
    // Update password + set flag_valid = true
    await this.userRepo.update(user.user_sys_id, {
      password: hashedPassword,
      flag_valid: true,  // ✅ เปลี่ยนเป็น true หลังจาก reset password
      updated_at: new Date(),
    });

    console.log(`✅ [AUTH] Password reset successfully for ${email}, flag_valid set to true`);

    return {
      success: true,
      message: 'Password reset successful. Please login with your new password.',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const { email } = dto;

    const user = await this.userRepo.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('Email not found');
    }

    const tempPassword = generateInitialPassword();
    const hashedPassword = await hashPassword(tempPassword);

    // 🔥 Update password + set flag_valid = false (ต้อง reset password ก่อนใช้งาน)
    await this.userRepo.update(user.user_sys_id, {
      password: hashedPassword,
      flag_valid: false, // ✅ เพิ่มนี้
      updated_at: new Date(),
    });

    console.log(`📧 [AUTH] Temporary password for ${email}: ${tempPassword}`);
    console.log(`🔑 [AUTH] flag_valid set to false - require password reset`);

    // ส่งอีเมล Temporary Password
    try {
      console.log('📧 [AUTH] Attempting to send temp password email...');
      await sendTempPasswordEmail(email, tempPassword);
      console.log('✅ [AUTH] Temp password email sent successfully');
    } catch (error) {
      console.error('❌ [AUTH] Failed to send temp password email:', error);
      // ไม่ throw error เพื่อให้ในโหมด development ยังใช้งานได้
    }

    return {
      success: true,
      message: 'Temporary password has been sent to your email',
      ...(process.env.NODE_ENV === 'development' && { _dev_password: tempPassword }),
    };
  }
}