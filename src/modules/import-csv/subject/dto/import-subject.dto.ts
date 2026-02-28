import { IsString, IsOptional, IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class ImportSubjectReqDto {
  @ApiProperty({ example: 1, description: 'ID ของสถาบัน' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  instId!: number;

  @ApiPropertyOptional({ description: 'Token ที่ได้จาก validate endpoint' })
  @IsOptional()
  @IsString()
  validationToken?: string;
}

export class ImportSubjectDto {
  @ApiProperty({ description: 'กลุ่มการเรียนรู้', example: 'คณิตศาสตร์' })
  @IsNotEmpty({ message: 'กลุ่มการเรียนรู้ห้ามว่าง' })
  @Expose({ name: 'กลุ่มการเรียนรู้' })
  @IsString({ message: 'กลุ่มการเรียนรู้ต้องเป็นข้อความ' })
  @Transform(({ value }) => value?.toString().trim() || '')
  learningArea!: string;

  @ApiProperty({ description: 'รหัสวิชา', example: 'ค12345' })
  @IsNotEmpty({ message: 'รหัสวิชาห้ามว่าง' })
  @Expose({ name: 'รหัสวิชา' })
  @IsString({ message: 'รหัสวิชาต้องเป็นข้อความ' })
  @Transform(({ value }) => value?.toString().trim() || '')
  subjectCode!: string;

  @ApiProperty({ description: 'ชื่อวิชา (ภาษาไทย)', example: 'คณิตศาสตร์' })
  @IsNotEmpty({ message: 'ชื่อวิชา (ภาษาไทย) ห้ามว่าง' })
  @Expose({ name: 'ชื่อวิชา (ภาษาไทย)' })
  @IsString({ message: 'ชื่อวิชา (ภาษาไทย) ต้องเป็นข้อความ' })
  @Transform(({ value }) => value?.toString().trim() || '')
  subjectNameTH!: string;

  @ApiPropertyOptional({
    description: 'ชื่อวิชา (ภาษาอังกฤษ)',
    example: 'Mathematics',
  })
  @IsOptional()
  @Expose({ name: 'ชื่อวิชา (ภาษาอังกฤษ)' })
  @IsString({ message: 'ชื่อวิชา (ภาษาอังกฤษ) ต้องเป็นข้อความ' })
  @Transform(({ value }) => value?.toString().trim() || null)
  subjectNameENG?: string | null;

  @ApiPropertyOptional({ description: 'หน่วยกิต', example: '3' })
  @IsNotEmpty({ message: 'หน่วยกิตห้ามว่าง' })
  @Expose({ name: 'หน่วยกิต' })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value.toString());
    return isNaN(num) ? null : num;
  })
  credit?: number | null;

  @ApiPropertyOptional({ description: 'ชั่วโมงต่อสัปดาห์', example: '3' })
  @IsNotEmpty({ message: 'ชั่วโมงต่อสัปดาห์ห้ามว่าง' })
  @Expose({ name: 'ชั่วโมงต่อสัปดาห์' })
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    const num = parseInt(value.toString(), 10);
    return isNaN(num) ? null : num;
  })
  hourPerWeek?: number | null;
}
