import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsMilitaryTime,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class ImportSectionReqDto {
  @ApiProperty({ example: 1, description: 'ID ของสถาบัน' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  instId!: number;

  @ApiProperty({ example: 1, description: 'ID ของ semester' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  semesterId!: number;
}

export class ImportSectionScheduleDto {
  @ApiProperty({ description: 'รหัสวิชา', example: 'MATH101' })
  @IsNotEmpty({ message: 'รหัสวิชาห้ามว่าง' })
  @Expose({ name: 'รหัสวิชา' })
  @IsString({ message: 'รหัสวิชาต้องเป็นข้อความ' })
  subjectCode!: string;

  @ApiProperty({ description: 'กล่มเรียน', example: 'SEC 1' })
  @IsNotEmpty({ message: 'กลุ่มเรียนห้ามว่าง' })
  @Expose({ name: 'กลุ่มเรียน' })
  @IsString({ message: 'กลุ่มเรียนต้องเป็นข้อความ' })
  sectionName!: string;

  @ApiProperty({ description: 'วันที่เรียน', example: 'จันทร์' })
  @IsNotEmpty({ message: 'วันที่เรียนห้ามว่าง' })
  @Expose({ name: 'วัน' })
  @IsString({ message: 'วันที่เรียนต้องเป็นข้อความ' })
  day!: string;

  @ApiProperty({ description: 'เวลาเริ่มเรียน', example: '08:00' })
  @IsNotEmpty({ message: 'เวลาเริ่มเรียนห้ามว่าง' })
  @Expose({ name: 'เวลาเริ่มเรียน' })
  @IsMilitaryTime()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    if (value.length === 4 && value.includes(':')) {
      return `0${value}`;
    }
    return value;
  })
  startTime!: string;

  @ApiProperty({ description: 'เวลาสิ้นสุด', example: '08:00' })
  @IsNotEmpty({ message: 'เวลาสิ้นสุดห้ามว่าง' })
  @Expose({ name: 'เวลาสิ้นสุด' })
  @IsMilitaryTime()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    if (value.length === 4 && value.includes(':')) {
      return `0${value}`;
    }
    return value;
  })
  endTime!: string;

  @ApiProperty({ description: 'ตึก', example: 'A' })
  @IsNotEmpty({ message: 'ตึกห้ามว่าง' })
  @Expose({ name: 'ตึก' })
  @IsString({ message: 'ตึกต้องเป็นข้อความ' })
  building!: string;

  @ApiProperty({ description: 'หมายเลขตึก', example: '1' })
  @IsNotEmpty({ message: 'เลขตึกห้ามว่าง' })
  @Expose({ name: 'หมายเลขตึก' })
  @IsString({ message: 'หมายเลขตึกต้องเป็นข้อความ' })
  buildingNo!: string;

  @ApiProperty({ description: 'ห้องเรียน', example: 'R101' })
  @IsNotEmpty({ message: 'ห้องเรียนห้ามว่าง' })
  @Expose({ name: 'ห้องเรียน' })
  @IsString({ message: 'ห้องเรียนต้องเป็นข้อความ' })
  classroom!: string;

  @ApiProperty({ description: 'รหัสผู้สอน', example: 'T001' })
  @IsNotEmpty({ message: 'รหัสผู้สอนหลักห้ามว่าง' })
  @Expose({ name: 'รหัสผู้สอนหลัก' })
  @IsString({ message: 'รหัสผู้สอนต้องเป็นข้อความ' })
  mainTeacherCode!: string;

  @ApiPropertyOptional({ description: 'รหัสผู้สอนรอง', example: 'T001' })
  @IsOptional()
  @Expose({ name: 'รหัสผู้สอนรอง' })
  @IsString({ message: 'รหัสผู้สอนรองต้องเป็นข้อความ' })
  coTeacherCode?: string;

  @ApiPropertyOptional({ description: 'รหัสผู้ช่วยสอน', example: 'T001' })
  @IsOptional()
  @Expose({ name: 'รหัสผู้ช่วยสอน' })
  @IsString({ message: 'รหัสผู้ช่วยสอนต้องเป็นข้อความ' })
  taCode?: string;
}
