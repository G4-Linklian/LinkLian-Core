import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsEmail,
  Length,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ImportStudentReqDto {
  @ApiProperty({ example: 1, description: 'ID ของสถาบัน' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  instId!: number;

  @ApiProperty({ example: 'school', description: 'ประเภทสถาบัน' })
  @IsNotEmpty()
  @IsString()
  instType!: string;

  @ApiPropertyOptional({ description: 'Token ที่ได้จาก validate endpoint' })
  @IsOptional()
  @IsString()
  validationToken?: string;
}

export class ImportStudentDto {
  @ApiProperty({ description: 'ชื่อนักเรียน', example: 'จีมิน' })
  @IsNotEmpty({ message: 'ชื่อจริงห้ามว่าง' })
  @Expose({ name: 'ชื่อจริง' })
  @IsString({ message: 'ชื่อจริงต้องเป็นข้อความ' })
  studentName!: string;

  @ApiProperty({ description: 'นามสกุลนักเรียน', example: 'พัค' })
  @IsNotEmpty({ message: 'นามสกุลห้ามว่าง' })
  @Expose({ name: 'นามสกุล' })
  @IsString({ message: 'นามสกุลต้องเป็นข้อความ' })
  studentLastName!: string;

  @ApiPropertyOptional({
    description: 'อีเมลนักเรียน',
    example: 'jimin.pak@example.com',
  })
  @IsNotEmpty({ message: 'อีเมลห้ามว่าง' })
  @Expose({ name: 'อีเมล' })
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  studentEmail?: string;

  @ApiPropertyOptional({
    description: 'เบอร์โทรศัพท์นักเรียน',
    example: '0812345678',
  })
  @IsOptional()
  @Expose({ name: 'เบอร์โทร' })
  @ValidateIf(
    (o) =>
      o.studentPhone !== '' &&
      o.studentPhone !== null &&
      o.studentPhone !== undefined,
  )
  @IsString({ message: 'เบอร์โทรศัพท์ต้องเป็นข้อความ' })
  @Length(10, 10, { message: 'เบอร์โทรศัพท์ต้องมีความยาว 10 หลัก' })
  studentPhone?: string;

  @ApiPropertyOptional({ description: 'ระดับชั้น/ชั้นปี', example: 'ม.3' })
  @IsNotEmpty({ message: 'ระดับชั้นห้ามว่าง' })
  @Expose({ name: 'ระดับชั้น/ชั้นปี' })
  @IsString({ message: 'ระดับชั้นต้องเป็นข้อความ' })
  eduLevel!: string;

  @ApiPropertyOptional({ description: 'สถานะผู้ใช้', example: true })
  @IsNotEmpty({ message: 'สถานะผู้ใช้ห้ามว่าง' })
  @Expose({ name: 'สถานะผู้ใช้' })
  @IsString({ message: 'สถานะผู้ใช้ต้องเป็นข้อความ' })
  studentStatus!: string;
}

export class ImportSchoolStudentDto extends ImportStudentDto {
  @ApiProperty({ description: 'รหัสนักเรียน', example: '12345' })
  @IsNotEmpty({ message: 'รหัสนักเรียนห้ามว่าง' })
  @Expose({ name: 'รหัสนักเรียน' })
  @IsString({ message: 'รหัสนักเรียนต้องเป็นข้อความ' })
  studentId!: string;

  @ApiPropertyOptional({ description: 'ห้องเรียน', example: '1' })
  @IsNotEmpty({ message: 'ห้องเรียนห้ามว่าง' })
  @Expose({ name: 'ห้องเรียน' })
  @IsString({ message: 'ห้องเรียนต้องเป็นข้อความ' })
  classroom!: string;

  @ApiPropertyOptional({ description: 'แผนการเรียน', example: 'วิทย์-คณิต' })
  @IsNotEmpty({ message: 'แผนการเรียนห้ามว่าง' })
  @Expose({ name: 'แผนการเรียน' })
  @IsString({ message: 'แผนการเรียนต้องเป็นข้อความ' })
  studyPlan!: string;
}

export class ImportUniStudentDto extends ImportStudentDto {
  @ApiProperty({ description: 'รหัสนักศึกษา', example: '12345' })
  @IsNotEmpty({ message: 'รหัสนักศึกษาห้ามว่าง' })
  @Expose({ name: 'รหัสนักศึกษา' })
  @IsString({ message: 'รหัสนักศึกษาต้องเป็นข้อความ' })
  studentId!: string;

  @ApiPropertyOptional({ description: 'คณะ', example: 'วิทยาศาสตร์' })
  @IsNotEmpty({ message: 'คณะห้ามว่าง' })
  @Expose({ name: 'คณะ' })
  @IsString({ message: 'คณะต้องเป็นข้อความ' })
  faculty!: string;

  @ApiPropertyOptional({ description: 'ภาค', example: 'คณิตศาสตร์' })
  @IsNotEmpty({ message: 'ภาคห้ามว่าง' })
  @Expose({ name: 'ภาค' })
  @IsString({ message: 'ภาคต้องเป็นข้อความ' })
  department!: string;

  @ApiPropertyOptional({
    description: 'สาขา',
    example: 'วิทยาการคอมพิวเตอร์ประยุกต์',
  })
  @IsNotEmpty({ message: 'สาขาห้ามว่าง' })
  @Expose({ name: 'สาขา' })
  @IsString({ message: 'สาขาต้องเป็นข้อความ' })
  major!: string;
}
