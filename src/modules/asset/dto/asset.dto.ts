import {
    IsString,
    IsOptional,
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { AssetStatus } from '../entities/asset.entity';

export class SearchAssetDto {
    @ApiPropertyOptional({ description: 'Asset ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    theme_id?: number;

    @ApiPropertyOptional({ description: 'Theme name', example: 'Theme 1' })
    @IsOptional()
    @IsString()
    theme_name?: string;

    @ApiPropertyOptional({ description: 'Theme URL', example: 'https://example.com/theme1.png' })
    @IsOptional()
    @IsString()
    theme_url?: string;

    @ApiPropertyOptional({
        description: 'Start date (YYYY-MM-DD)',
        example: '2024-05-01',
    })
    @IsOptional()
    @IsString()
    start_date?: string;

    @ApiPropertyOptional({
        description: 'End date (YYYY-MM-DD)',
        example: '2024-09-30',
    })
    @IsOptional()
    @IsString()
    end_date?: string;

    @ApiPropertyOptional({ description: 'Default flag', example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    is_default?: boolean;

    @ApiPropertyOptional({
        description: 'Status',
        example: 'active',
        enum: AssetStatus,
    })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Valid flag', example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    flag_valid?: boolean;

    @ApiPropertyOptional({ description: 'Sort by field', example: 'theme_id' })
    @IsOptional()
    @IsString()
    sort_by?: string;

    @ApiPropertyOptional({
        description: 'Sort order',
        example: 'ASC',
        enum: ['ASC', 'DESC'],
    })
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

export class CreateAssetDto {
    @ApiProperty({ description: 'Theme name', example: 'Theme 1' })
    @IsNotEmpty()
    @IsString()
    theme_name!: string;

    @ApiPropertyOptional({ description: 'Theme URL (filled from uploaded file URL by backend)', example: 'https://example.com/theme1.png' })
    @IsOptional()
    @IsString()
    theme_url?: string;

    @ApiPropertyOptional({
        description: 'Start date (YYYY-MM-DD)',
        example: '2024-05-01',
    })
    @IsOptional()
    @IsDateString()
    start_date?: string;

    @ApiPropertyOptional({
        description: 'End date (YYYY-MM-DD)',
        example: '2024-09-30',
    })
    @IsOptional()
    @IsDateString()
    end_date?: string;

    @ApiProperty({ description: 'Default flag', example: false })
    @IsNotEmpty()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    is_default!: boolean;

    @ApiProperty({ description: 'Valid flag', example: true })
    @IsNotEmpty()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    flag_valid!: boolean;

    @ApiPropertyOptional({
        description: 'Status',
        example: 'pending',
        enum: AssetStatus,
    })
    @IsOptional()
    @IsString()
    status?: string;
}

export class UpdateAssetDto {
    @ApiPropertyOptional({ description: 'Theme name', example: 'Theme 1' })
    @IsOptional()
    @IsString()
    theme_name?: string;

    @ApiPropertyOptional({ description: 'Theme URL', example: 'https://example.com/theme1.png' })
    @IsOptional()
    @IsString()
    theme_url?: string;

    @ApiPropertyOptional({
        description: 'Start date (YYYY-MM-DD)',
        example: '2024-05-01',
    })
    @IsOptional()
    @IsDateString()
    start_date?: string;

    @ApiPropertyOptional({
        description: 'End date (YYYY-MM-DD)',
        example: '2024-09-30',
    })
    @IsOptional()
    @IsDateString()
    end_date?: string;

    @ApiPropertyOptional({ description: 'Default flag', example: false })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    is_default?: boolean;

    @ApiPropertyOptional({ description: 'Valid flag', example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    flag_valid?: boolean;

    @ApiPropertyOptional({
        description: 'Status',
        example: 'active',
        enum: AssetStatus,
    })
    @IsOptional()
    @IsString()
    status?: string;
}

export class DeleteAssetDto {
    @ApiProperty({ description: 'Asset ID', example: 1 })
    @IsNotEmpty()
    @Type(() => Number)
    @IsInt()
    theme_id!: number;
}
