// dto/institution.dto.ts
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SearchInstitutionDto {
  @ApiPropertyOptional({ description: 'รหัสสถาบัน', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({
    description: 'อีเมลสถาบัน',
    example: 'info@university.ac.th',
  })
  @IsOptional()
  @IsEmail()
  inst_email?: string;

  @ApiPropertyOptional({
    description: 'ชื่อสถาบัน (ภาษาไทย)',
    example: 'มหาวิทยาลัยตัวอย่าง',
  })
  @IsOptional()
  @IsString()
  inst_name_th?: string;

  @ApiPropertyOptional({
    description: 'ชื่อสถาบัน (ภาษาอังกฤษ)',
    example: 'Example University',
  })
  @IsOptional()
  @IsString()
  inst_name_en?: string;

  @ApiPropertyOptional({
    description: 'ชื่อย่อสถาบัน (ภาษาไทย)',
    example: 'มตย.',
  })
  @IsOptional()
  @IsString()
  inst_abbr_th?: string;

  @ApiPropertyOptional({
    description: 'ชื่อย่อสถาบัน (ภาษาอังกฤษ)',
    example: 'EU',
  })
  @IsOptional()
  @IsString()
  inst_abbr_en?: string;

  @ApiPropertyOptional({ description: 'ประเภทสถาบัน', example: 'university' })
  @IsOptional()
  @IsString()
  inst_type?: string;

  @ApiPropertyOptional({
    description: 'สถานะการอนุมัติ',
    example: 'pending',
    enum: ['pending', 'approved', 'rejected'],
  })
  @IsOptional()
  @IsString()
  approve_status?: string;

  @ApiPropertyOptional({ description: 'สถานะการใช้งาน', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({
    description: 'แหล่งที่มา (admin สำหรับ filter พิเศษ)',
    example: 'admin',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    description: 'ฟิลด์ที่ใช้เรียงลำดับ',
    example: 'inst_name_th',
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

export class CreateInstitutionDto {
  @ApiProperty({ description: 'อีเมลสถาบัน', example: 'info@university.ac.th' })
  @IsEmail()
  inst_email!: string;

  @ApiProperty({ description: 'รหัสผ่าน', example: 'password123' })
  @IsString()
  inst_password!: string;

  @ApiProperty({
    description: 'ชื่อสถาบัน (ภาษาไทย)',
    example: 'มหาวิทยาลัยตัวอย่าง',
  })
  @IsString()
  inst_name_th!: string;

  @ApiProperty({
    description: 'ชื่อสถาบัน (ภาษาอังกฤษ)',
    example: 'Example University',
  })
  @IsOptional()
  @IsString()
  inst_name_en?: string;

  @ApiProperty({ description: 'ชื่อย่อสถาบัน (ภาษาไทย)', example: 'มตย.' })
  @IsOptional()
  @IsString()
  inst_abbr_th?: string;

  @ApiProperty({ description: 'ชื่อย่อสถาบัน (ภาษาอังกฤษ)', example: 'EU' })
  @IsOptional()
  @IsString()
  inst_abbr_en?: string;

  @ApiProperty({ description: 'ประเภทสถาบัน', example: 'university' })
  @IsString()
  inst_type!: string;

  @ApiProperty({ description: 'เบอร์โทรศัพท์', example: '02-123-4567' })
  @IsOptional()
  @IsString()
  inst_phone?: string;

  @ApiProperty({
    description: 'เว็บไซต์',
    example: 'https://www.university.ac.th',
  })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ description: 'ที่อยู่', example: '123 ถนนพหลโยธิน' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'ตำบล/แขวง', example: 'จตุจักร' })
  @IsOptional()
  @IsString()
  subdistrict?: string;

  @ApiProperty({ description: 'อำเภอ/เขต', example: 'จตุจักร' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ description: 'จังหวัด', example: 'กรุงเทพมหานคร' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiProperty({ description: 'รหัสไปรษณีย์', example: '10900' })
  @IsOptional()
  @IsString()
  postal_code?: string;

  @ApiProperty({
    description: 'URL โลโก้',
    example: 'https://example.com/logo.png',
  })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiProperty({
    description: 'URL เอกสาร',
    example: 'https://example.com/docs.pdf',
  })
  @IsOptional()
  @IsString()
  docs_url!: string;
}

export class UpdateInstitutionDto {
  @ApiPropertyOptional({
    description: 'อีเมลสถาบัน',
    example: 'info@university.ac.th',
  })
  @IsOptional()
  @IsEmail()
  inst_email?: string;

  @ApiPropertyOptional({ description: 'รหัสผ่าน', example: 'newpassword123' })
  @IsOptional()
  @IsString()
  inst_password?: string;

  @ApiPropertyOptional({
    description: 'ชื่อสถาบัน (ภาษาไทย)',
    example: 'มหาวิทยาลัยตัวอย่าง',
  })
  @IsOptional()
  @IsString()
  inst_name_th?: string;

  @ApiPropertyOptional({
    description: 'ชื่อสถาบัน (ภาษาอังกฤษ)',
    example: 'Example University',
  })
  @IsOptional()
  @IsString()
  inst_name_en?: string;

  @ApiPropertyOptional({
    description: 'ชื่อย่อสถาบัน (ภาษาไทย)',
    example: 'มตย.',
  })
  @IsOptional()
  @IsString()
  inst_abbr_th?: string;

  @ApiPropertyOptional({
    description: 'ชื่อย่อสถาบัน (ภาษาอังกฤษ)',
    example: 'EU',
  })
  @IsOptional()
  @IsString()
  inst_abbr_en?: string;

  @ApiPropertyOptional({ description: 'ประเภทสถาบัน', example: 'university' })
  @IsOptional()
  @IsString()
  inst_type?: string;

  @ApiPropertyOptional({ description: 'เบอร์โทรศัพท์', example: '02-123-4567' })
  @IsOptional()
  @IsString()
  inst_phone?: string;

  @ApiPropertyOptional({
    description: 'เว็บไซต์',
    example: 'https://www.university.ac.th',
  })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'ที่อยู่', example: '123 ถนนพหลโยธิน' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'ตำบล/แขวง', example: 'จตุจักร' })
  @IsOptional()
  @IsString()
  subdistrict?: string;

  @ApiPropertyOptional({ description: 'อำเภอ/เขต', example: 'จตุจักร' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'จังหวัด', example: 'กรุงเทพมหานคร' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional({ description: 'รหัสไปรษณีย์', example: '10900' })
  @IsOptional()
  @IsString()
  postal_code?: string;

  @ApiPropertyOptional({
    description: 'URL โลโก้',
    example: 'https://example.com/logo.png',
  })
  @IsOptional()
  @IsString()
  logo_url?: string;

  @ApiPropertyOptional({
    description: 'URL เอกสาร',
    example: 'https://example.com/docs.pdf',
  })
  @IsOptional()
  @IsString()
  docs_url?: string;

  @ApiPropertyOptional({
    description: 'สถานะการอนุมัติ',
    example: 'approved',
    enum: ['pending', 'approved', 'rejected'],
  })
  @IsOptional()
  @IsString()
  approve_status?: string;

  @ApiPropertyOptional({ description: 'สถานะการใช้งาน', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;
}

export class LoginInstitutionDto {
  @ApiProperty({ description: 'อีเมลสถาบัน', example: 'info@university.ac.th' })
  @IsEmail()
  inst_email!: string;

  @ApiProperty({ description: 'รหัสผ่าน', example: 'password123' })
  @IsString()
  inst_password!: string;
}
