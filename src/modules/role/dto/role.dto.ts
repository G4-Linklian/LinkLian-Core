// dto/role.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SearchRoleDto {
  @ApiPropertyOptional({ description: 'รหัส Role', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  role_id?: number;

  @ApiPropertyOptional({ description: 'ชื่อ Role', example: 'admin' })
  @IsOptional()
  @IsString()
  role_name?: string;

  @ApiPropertyOptional({ description: 'ประเภท Role', example: 'system' })
  @IsOptional()
  @IsString()
  role_type?: string;

  @ApiPropertyOptional({
    description: 'สิทธิ์การเข้าถึง (JSON)',
    example: { read: true, write: true },
  })
  @IsOptional()
  @IsObject()
  access?: object;

  @ApiPropertyOptional({ description: 'สถานะการใช้งาน', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({
    description: 'ฟิลด์ที่ใช้เรียงลำดับ',
    example: 'role_name',
  })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'ลำดับการเรียง',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
  })
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

export class CreateRoleDto {
  @ApiProperty({ description: 'ชื่อ Role', example: 'admin' })
  @IsString()
  role_name!: string;

  @ApiProperty({ description: 'ประเภท Role', example: 'system' })
  @IsString()
  role_type!: string;

  @ApiProperty({
    description: 'สิทธิ์การเข้าถึง (JSON)',
    example: { read: true, write: true, delete: false },
  })
  @IsObject()
  access!: object;

  @ApiPropertyOptional({
    description: 'สถานะการใช้งาน',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'ชื่อ Role', example: 'admin' })
  @IsOptional()
  @IsString()
  role_name?: string;

  @ApiPropertyOptional({ description: 'ประเภท Role', example: 'system' })
  @IsOptional()
  @IsString()
  role_type?: string;

  @ApiPropertyOptional({
    description: 'สิทธิ์การเข้าถึง (JSON)',
    example: { read: true, write: true, delete: true },
  })
  @IsOptional()
  @IsObject()
  access?: object;

  @ApiPropertyOptional({ description: 'สถานะการใช้งาน', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}
