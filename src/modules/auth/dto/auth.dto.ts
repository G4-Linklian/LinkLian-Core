import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsEmail,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Username (email)',
    example: 'tanyatorn.kong@gmail.com',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Password',
    example: 'password123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'User group (student/teacher)',
    example: 'teacher',
    required: false,
  })
  @IsString()
  @IsOptional()
  user_group?: string;

  @ApiProperty({
    description: 'Remember me (30 days)',
    example: true,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  remember_me?: boolean;
}

export class VerifyTokenDto {
  @ApiProperty({
    description: 'JWT Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class VerifyOTPDto {
  @ApiProperty({
    description: 'OTP Code (6 digits)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({
    description: 'OTP Session ID',
    example: 'uuid-session-id',
  })
  @IsString()
  @IsNotEmpty()
  otp_session_id: string;

  @ApiProperty({
    description: 'Remember me',
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  remember_me?: boolean;
}

export class ResendOTPDto {
  @ApiProperty({
    description: 'OTP Session ID',
    example: 'uuid-session-id',
  })
  @IsString()
  @IsNotEmpty()
  otp_session_id: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Email' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Current/Initial Password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: 'New Password' })
  @IsString()
  @IsNotEmpty()
  new_password: string;

  @ApiProperty({ description: 'Confirm New Password' })
  @IsString()
  @IsNotEmpty()
  confirm_password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email' })
  @IsString()
  @IsNotEmpty()
  email: string;
}

export class RegisterDto {
  @ApiProperty({ description: 'Email' })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'First Name' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ description: 'Last Name' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ description: 'Middle Name (optional)' })
  @IsString()
  @IsOptional()
  middle_name?: string;

  @ApiProperty({ description: 'Phone (optional)' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Role ID' })
  @IsNumber()
  @IsNotEmpty()
  role_id: number;

  @ApiProperty({ description: 'User Code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Institution ID' })
  @IsNumber()
  @IsNotEmpty()
  inst_id: number;

  @ApiProperty({ description: 'Education Level ID (optional)' })
  @IsNumber()
  @IsOptional()
  edu_lev_id?: number;
}
