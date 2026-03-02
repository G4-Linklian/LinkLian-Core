import { IsString, IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ImportProgramReqDto {
  @ApiProperty({ example: 1, description: 'ID ของสถาบัน' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  instId!: number;

  @ApiProperty({ example: 1, description: 'ประเภทสถาบัน' })
  @IsNotEmpty()
  @IsString()
  instType!: string;
}

export class ImportSchoolProgramDto {
  @ApiProperty({ description: 'แผนการเรียน', example: 'วิทย์-คณิต' })
  @IsNotEmpty({ message: 'แผนการเรียนห้ามว่าง' })
  @Expose({ name: 'แผนการเรียน' })
  @IsString({ message: 'แผนการเรียนต้องเป็นข้อความ' })
  programName!: string;

  @ApiProperty({ description: 'ห้องเรียน', example: '1' })
  @IsNotEmpty({ message: 'ห้องเรียนห้ามว่าง' })
  @Expose({ name: 'ห้องเรียน' })
  @IsString({ message: 'ห้องเรียนต้องเป็นข้อความ' })
  className!: string;
}

export class ImportUniProgramDto {
  @ApiProperty({ description: 'คณะ', example: 'วิทยาศาสตร์' })
  @IsNotEmpty({ message: 'คณะห้ามว่าง' })
  @Expose({ name: 'คณะ' })
  @IsString({ message: 'คณะต้องเป็นข้อความ' })
  faculty!: string;

  @ApiProperty({ description: 'ภาค', example: 'คณิตศาสตร์' })
  @IsNotEmpty({ message: 'ภาคห้ามว่าง' })
  @Expose({ name: 'ภาค' })
  @IsString({ message: 'ภาคต้องเป็นข้อความ' })
  department!: string;

  @ApiProperty({ description: 'สาขา', example: 'คณิตศาสตร์' })
  @IsNotEmpty({ message: 'สาขาห้ามว่าง' })
  @Expose({ name: 'สาขา' })
  @IsString({ message: 'สาขาต้องเป็นข้อความ' })
  major!: string;
}
