import { IsString, IsOptional, IsBoolean, IsInt, IsEmail, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ImportTeacherReqDto {
    @ApiProperty({ example: 1, description: 'ID ของสถาบัน' })
    @IsNotEmpty()
    @Type(() => Number) 
    @IsInt()
    instId: number;

    @ApiProperty({ example: 1, description: 'ประเภทสถาบัน' })
    @IsNotEmpty()
    @IsString()
    instType: string;
}

export class ImportTeacherDto {
    @ApiProperty({ description: 'รหัสบุคลากร', example: '12345' })
    @IsNotEmpty({ message: 'รหัสบุคลากรห้ามว่าง' })
    @Expose({ name: 'รหัสบุคลากร' })
    @IsString()
    teacherId: string;

    @ApiProperty({ description: 'ชื่อบุคลากร', example: 'จีมิน' })
    @IsNotEmpty({ message: 'ชื่อจริงห้ามว่าง' })
    @Expose({ name: 'ชื่อจริง' })
    @IsString()
    teacherName: string;
     
    @ApiProperty({ description: 'นามสกุลบุคลากร', example: 'พัค' })
    @IsNotEmpty({ message: 'นามสกุลห้ามว่าง' })
    @Expose({ name: 'นามสกุล' })
    @IsString()
    teacherLastName: string;

    @ApiPropertyOptional({ description: 'อีเมลบุคลากร', example: 'jimin.pak@example.com' })
    @IsNotEmpty({ message: 'อีเมลห้ามว่าง' })
    @Expose({ name: 'อีเมล' })
    @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
    teacherEmail?: string;

    @ApiPropertyOptional({ description: 'เบอร์โทรศัพท์บุคลากร', example: '0812345678' })
    @IsOptional()
    @Expose({ name: 'เบอร์โทร' })
    @IsString()
    @Length(10, 10, { message: 'เบอร์โทรศัพท์ต้องมีความยาว 10 หลัก' })
    teacherPhone?: string;

    @ApiPropertyOptional({ description: 'กลุ่มการเรียนรู้', example: 'วิทยาศาสตร์' })
    @IsNotEmpty({ message: 'กลุ่มการเรียนรู้ห้ามว่าง' })
    @Expose({ name: 'กลุ่มการเรียนรู้' })
    @IsString()
    learningArea: string;

    @ApiPropertyOptional({ description: 'สถานะผู้ใช้', example: 'ใช้งาน' })
    @IsNotEmpty({ message: 'สถานะผู้ใช้ห้ามว่าง' })
    @Expose({ name: 'สถานะผู้ใช้' })
    @IsString()
    teacherStatus: string;
}