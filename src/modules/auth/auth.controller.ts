import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBearerAuth, // 👈 เพิ่มนี้
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto,
  VerifyTokenDto,
  VerifyOTPDto,
  ResendOTPDto,
  ResetPasswordDto,
  ForgotPasswordDto,
} from './dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login for users (students/teachers)',
    description:
      '⚠️ No authorization required - This is the first step to get a token',
  })
  @ApiHeader({
    name: 'Authorization',
    required: false,
    description: '(Optional) Bearer token - Skip OTP if valid token exists',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful (with token) OR OTP sent to email',
    schema: {
      oneOf: [
        {
          // Response with token (skip OTP)
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login successful' },
            access_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            user_id: { type: 'number', example: 1 },
            role_name: { type: 'string', example: 'teacher' },
            inst_id: { type: 'number', example: 1 },
          },
        },
        {
          // Response with OTP
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'OTP sent to your email' },
            otp_session_id: { type: 'string', example: 'uuid-here' },
            otp_expires_at: {
              type: 'string',
              example: '2025-01-29T12:05:00.000Z',
            },
            _dev_otp: {
              type: 'string',
              example: '123456',
              description: 'Only in development',
            },
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.authService.login(dto, authorization);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP code',
    description: '⚠️ No authorization required - Use OTP from login response',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP verified - Returns access token',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Login successful' },
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        user_id: { type: 'number', example: 1 },
        role_name: { type: 'string', example: 'teacher' },
        inst_id: { type: 'number', example: 1 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOTP(@Body() dto: VerifyOTPDto) {
    return this.authService.verifyOTP(dto);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP code',
    description: '⚠️ No authorization required',
  })
  @ApiResponse({ status: 200, description: 'New OTP sent' })
  @ApiResponse({ status: 401, description: 'Session expired' })
  async resendOTP(@Body() dto: ResendOTPDto) {
    return this.authService.resendOTP(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth() // 👈 เฉพาะ endpoint นี้ต้องมี token
  @ApiOperation({
    summary: 'Verify JWT token',
    description: '🔒 Requires Authorization header',
  })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async verify(@Body() dto: VerifyTokenDto) {
    return this.authService.verifyToken(dto.token);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset initial password',
    description:
      '⚠️ No authorization required - Use for first-time password change',
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request temporary password',
    description:
      '⚠️ No authorization required - Get temporary password via email',
  })
  @ApiResponse({ status: 200, description: 'Temporary password sent' })
  @ApiResponse({ status: 404, description: 'Email not found' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }
}
