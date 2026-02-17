import { IsString, IsOptional, IsNotEmpty, IsInt, IsEmail, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class ImportStudentReqDto {
    @ApiProperty({ example: 1, description: 'ID ของสถาบัน' })
    @IsNotEmpty()
    @Type(() => Number)
    @IsInt()
    instId: number;

    @ApiProperty({ example: 'school', description: 'ประเภทสถาบัน' })
    @IsNotEmpty()
    @IsString()
    instType: string;

    @ApiPropertyOptional({ description: 'Token ที่ได้จาก validate endpoint' })
    @IsOptional()
    @IsString()
    validationToken?: string;
}

export class ImportStudentDto {
    @ApiProperty({ description: 'รหัสนักเรียน', example: '12345' })
    @IsNotEmpty({ message: 'รหัสนักเรียนห้ามว่าง' })
    @Expose({ name: 'รหัสนักเรียน' })
    @IsString()
    studentId: string;

    @ApiProperty({ description: 'ชื่อนักเรียน', example: 'จีมิน' })
    @IsNotEmpty({ message: 'ชื่อจริงห้ามว่าง' })
    @Expose({ name: 'ชื่อจริง' })
    @IsString()
    studentName: string;

    @ApiProperty({ description: 'นามสกุลนักเรียน', example: 'พัค' })
    @IsNotEmpty({ message: 'นามสกุลห้ามว่าง' })
    @Expose({ name: 'นามสกุล' })
    @IsString()
    studentLastName: string;

    @ApiPropertyOptional({ description: 'อีเมลนักเรียน', example: 'jimin.pak@example.com' })
    @IsNotEmpty({ message: 'อีเมลห้ามว่าง' })
    @Expose({ name: 'อีเมล' })
    @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
    studentEmail?: string;

    @ApiPropertyOptional({ description: 'เบอร์โทรศัพท์นักเรียน', example: '0812345678' })
    @IsOptional()
    @Expose({ name: 'เบอร์โทร' })
    @IsString()
    @Length(10, 10, { message: 'เบอร์โทรศัพท์ต้องมีความยาว 10 หลัก' })
    studentPhone?: string;

    @ApiPropertyOptional({ description: 'ระดับชั้น/ชั้นปี', example: 'ม.3' })
    @IsNotEmpty({ message: 'ระดับชั้นห้ามว่าง' })
    @Expose({ name: 'ระดับชั้น' })
    @IsString()
    eduLevel: string;

    @ApiPropertyOptional({ description: 'สถานะผู้ใช้', example: true })
    @IsNotEmpty({ message: 'สถานะผู้ใช้ห้ามว่าง' })
    @Expose({ name: 'สถานะผู้ใช้' })
    @IsString()
    studentStatus: string;
}

export class ImportSchoolStudentDto extends ImportStudentDto {
    @ApiPropertyOptional({ description: 'ห้องเรียน', example: '1' })
    @IsNotEmpty({ message: 'ห้องเรียนห้ามว่าง' })
    @Expose({ name: 'ห้องเรียน' })
    @IsString()
    classroom: string;

    @ApiPropertyOptional({ description: 'แผนการเรียน', example: 'วิทย์-คณิต' })
    @IsNotEmpty({ message: 'แผนการเรียนห้ามว่าง' })
    @Expose({ name: 'แผนการเรียน' })
    @IsString()
    studyPlan: string;
}

export class ImportUniStudentDto extends ImportStudentDto {
    @ApiPropertyOptional({ description: 'คณะ', example: 'วิทยาศาสตร์' })
    @IsNotEmpty({ message: 'คณะห้ามว่าง' })
    @Expose({ name: 'คณะ' })
    @IsString()
    faculty: string;

    @ApiPropertyOptional({ description: 'ภาค', example: 'คณิตศาสตร์' })
    @IsNotEmpty({ message: 'ภาคห้ามว่าง' })
    @Expose({ name: 'ภาค' })
    @IsString()
    department: string;

    @ApiPropertyOptional({ description: 'สาขา', example: 'วิทยาการคอมพิวเตอร์ประยุกต์' })
    @IsNotEmpty({ message: 'สาขาห้ามว่าง' })
    @Expose({ name: 'สาขา' })
    @IsString()
    major: string;
}
