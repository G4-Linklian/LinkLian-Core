import { IsString, IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ImportEnrollmentReqDto {
  @ApiProperty({ example: 1, description: 'ID ของสถาบัน' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  instId!: number;

  @ApiProperty({ example: 1, description: 'ID ของกลุ่มเรียน' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  sectionId!: number;
}

export class ImportEnrollmentDto {
  @ApiProperty({ description: 'รหัสนักเรียน', example: '11234' })
  @IsNotEmpty({ message: 'รหัสนักเรียนห้ามว่าง' })
  @Expose({ name: 'รหัสนักเรียน' })
  @IsString({ message: 'รหัสนักเรียนต้องเป็นข้อความ' })
  studentCode!: string;
}
