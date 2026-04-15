import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class SearchAdminReportDto {
  @ApiPropertyOptional({ description: 'Admin report ID', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  admin_report_id?: number;

  @ApiPropertyOptional({ description: 'Institution ID', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Resolved status', example: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  mark_resolved?: boolean;

  @ApiPropertyOptional({ description: 'Active status', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Keyword for title/detail', example: 'bug report' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'report_date' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['ASC', 'DESC'], example: 'DESC' })
  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Limit', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}

export class CreateAdminReportDto {
  @ApiProperty({ description: 'Institution ID', example: 10 })
  @Type(() => Number)
  @IsInt()
  inst_id!: number;

  @ApiProperty({ description: 'Report title', example: 'System issue' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Report detail', example: 'Cannot access dashboard from mobile.' })
  @IsString()
  detail!: string;

  @ApiPropertyOptional({ description: 'Report file metadata (JSON)', example: { files: [{ name: 'evidence.png' }] } })
  @IsOptional()
  @IsObject()
  report_file?: object;

  @ApiPropertyOptional({ description: 'Active status', default: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Report datetime in ISO format', example: '2026-04-12T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  report_date?: string;

  @ApiPropertyOptional({ description: 'Resolved status', default: false })
  @IsOptional()
  @IsBoolean()
  mark_resolved?: boolean;
}

export class UpdateAdminReportDto {
  @ApiPropertyOptional({ description: 'Institution ID', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Report title', example: 'Updated title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Report detail', example: 'Updated detail.' })
  @IsOptional()
  @IsString()
  detail?: string;

  @ApiPropertyOptional({ description: 'Report file metadata (JSON)', example: { files: [{ name: 'new-evidence.pdf' }] } })
  @IsOptional()
  @IsObject()
  report_file?: object;

  @ApiPropertyOptional({ description: 'Active status', example: true })
  @IsOptional()
  @IsBoolean()
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Report datetime in ISO format', example: '2026-04-12T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  report_date?: string;

  @ApiPropertyOptional({ description: 'Resolved status', example: true })
  @IsOptional()
  @IsBoolean()
  mark_resolved?: boolean;
}
