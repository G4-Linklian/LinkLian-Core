import { IsString, IsOptional, IsNotEmpty, IsInt} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';

export class ImportEnrollmentReqDto {
    @ApiProperty({ example: 1, description: 'ID ของสถาบัน' })
    @IsNotEmpty()
    @Type(() => Number) 
    @IsInt()
    instId: number;
}

export class ImportEnrollmentDto {
    @ApiProperty({ description: 'รหัสวิชา', example: 'ค12012' })
    @IsNotEmpty({ message: 'รหัสวิชาห้ามว่าง' })
    @Expose({ name: 'รหัสวิชา' })
    @IsString({ message: 'รหัสวิชาต้องเป็นข้อความ' })
    subjectCode!: string;

    @ApiProperty({ description: 'กลุ่มเรียน', example: 'sec 1' })
    @IsNotEmpty({ message: 'กลุ่มเรียนห้ามว่าง' })
    @Expose({ name: 'กลุ่มเรียน' })
    @IsString({ message: 'กลุ่มเรียนต้องเป็นข้อความ' })
    section!: string;

    @ApiProperty({ description: 'รหัสนักเรียน', example: '11234' })
    @IsNotEmpty({ message: 'รหัสนักเรียนห้ามว่าง' })
    @Expose({ name: 'รหัสนักเรียน' })
    @IsString({ message: 'รหัสนักเรียนต้องเป็นข้อความ' })
    studentCode!: string;
}