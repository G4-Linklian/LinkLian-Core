import { IsString, IsOptional, IsBoolean, IsInt, Matches, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SearchDashboardDto {
    @ApiPropertyOptional({ description: 'Dashboard ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    dashboard_id?: number;

    @ApiPropertyOptional({ description: 'User System ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    user_sys_id?: number;

    @ApiPropertyOptional({ 
        description: 'Role Type', 
        example: 'STUDENT',
        enum: ['STUDENT', 'TEACHER']
    })
    @IsOptional()
    @IsString()
    @IsIn(['STUDENT', 'TEACHER'])
    role_type?: 'STUDENT' | 'TEACHER';

    @ApiPropertyOptional({ description: 'Report Month', example: '2026-01' })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}$/, { message: 'report_month must be in the format YYYY-MM' })
    report_month?: string;

    @ApiPropertyOptional({ description: 'Valid flag', example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    flag_valid?: boolean;
}