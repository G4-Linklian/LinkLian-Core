// dto/admin.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SearchAdminDto {

  @ApiPropertyOptional({ description: 'ชื่อผู้ใช้', example: 'admin' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'สถานะการใช้งาน', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'ฟิลด์ที่ใช้เรียงลำดับ', example: 'username' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ description: 'ลำดับการเรียง', example: 'ASC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'จำนวนข้อมูลที่ต้องการ', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'ข้ามข้อมูลจำนวน', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}

export class CreateAdminDto {
  @ApiProperty({ description: 'ชื่อผู้ใช้', example: 'admin' })
  @IsString() username: string;

  @ApiProperty({ description: 'รหัสผ่าน', example: 'password123' })
  @IsString() password: string;

  @ApiPropertyOptional({ description: 'สถานะการใช้งาน', example: true, default: true })
  @IsOptional() @IsBoolean() flag_valid?: boolean;
}

export class UpdateAdminDto {
  @ApiPropertyOptional({ description: 'ชื่อผู้ใช้', example: 'admin' })
  @IsOptional() @IsString() username?: string;

  @ApiPropertyOptional({ description: 'รหัสผ่าน', example: 'newpassword123' })
  @IsOptional() @IsString() password?: string;

  @ApiPropertyOptional({ description: 'สถานะการใช้งาน', example: true })
  @IsOptional() @IsBoolean() flag_valid?: boolean;
}

export class LoginAdminDto {
  @ApiProperty({ description: 'ชื่อผู้ใช้', example: 'admin' })
  @IsString() username: string;

  @ApiProperty({ description: 'รหัสผ่าน', example: 'password123' })
  @IsString() password: string;
}
