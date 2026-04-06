import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SearchQALiveDto {
    @ApiPropertyOptional({ description: 'QA Live ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    qa_live_id?: number;

    @ApiPropertyOptional({ description: 'Section ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    section_id?: number;

    @ApiPropertyOptional({ description: 'Live By (User ID)', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    live_by?: number;

    @ApiPropertyOptional({ description: 'Live Title', example: 'Sample Live Title' })
    @IsOptional()
    @IsString()
    live_title?: string;

    @ApiPropertyOptional({ description: 'Status', example: 'ACTIVE' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Started At', example: '2024-01-01T00:00:00Z' })
    @IsOptional()
    @Type(() => Date)
    started_at?: Date;

    @ApiPropertyOptional({ description: 'Ended At', example: '2024-01-01T01:00:00Z' })
    @IsOptional()
    @Type(() => Date)
    ended_at?: Date;

    @ApiPropertyOptional({ description: 'Valid flag', example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    flag_valid?: boolean;

    @ApiPropertyOptional({ description: 'Sort by field', example: 'created_at' })
    @IsOptional()
    @IsString()
    sort_by?: string;

    @ApiPropertyOptional({
        description: 'Sort order',
        example: 'DESC',
        enum: ['ASC', 'DESC'],
    })
    @IsOptional()
    @IsString()
    sort_order?: 'ASC' | 'DESC';
}

export class CreateQALiveDto {
    @ApiProperty({ description: 'Section ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    section_id!: number;

    @ApiProperty({ description: 'Live Title', example: 'Sample Live Title' })
    @IsString()
    live_title!: string;

    @ApiProperty({ description: 'Post ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    post_id!: number;

    @ApiProperty({ description: 'Attachment ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    attachment_id!: number;

    @ApiPropertyOptional({ description: 'Live By (User ID)', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    live_by?: number;
}

export class UpdateQALiveDto {
    @ApiPropertyOptional({ description: 'Live By (User ID)', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    live_by?: number;

    @ApiPropertyOptional({ description: 'Status', example: 'END' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Flag Valid (for soft delete)', example: false })
    @IsOptional()
    @IsBoolean()
    flag_valid?: boolean;
}

export class SearchQALiveLogDto {
    @ApiPropertyOptional({ description: 'QA Live Log ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    log_id?: number;

    @ApiPropertyOptional({ description: 'QA Live ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    qa_live_id?: number;

    @ApiPropertyOptional({ description: 'Post ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    post_id?: number;

    @ApiPropertyOptional({ description: 'Attachment ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    attachment_id?: number;

    @ApiPropertyOptional({ description: 'Opened At', example: '2024-01-01T00:00:00Z' })
    @IsOptional()
    @Type(() => Date)
    opened_at?: Date;

    @ApiPropertyOptional({ description: 'Closed At', example: '2024-01-01T01:00:00Z' })
    @IsOptional()
    @Type(() => Date)
    closed_at?: Date;

    @ApiPropertyOptional({ description: 'Valid flag', example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    flag_valid?: boolean;

    @ApiPropertyOptional({ description: 'Sort by field', example: 'created_at' })
    @IsOptional()
    @IsString()
    sort_by?: string;

    @ApiPropertyOptional({
        description: 'Sort order',
        example: 'DESC',
        enum: ['ASC', 'DESC'],
    })
    @IsOptional()
    @IsString()
    sort_order?: 'ASC' | 'DESC';
}

export class CreateQALiveLogDto {
    @ApiProperty({ description: 'QA Live ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    qa_live_id!: number;

    @ApiProperty({ description: 'Post ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    post_id!: number;

    @ApiPropertyOptional({ description: 'Attachment ID (ถ้าเป็นการเปิดโพสต์เฉยๆ ไม่มีไฟล์ ให้เว้นว่างได้)', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    attachment_id?: number;
}

export class SearchSectionFilesDto {
    @ApiPropertyOptional({ description: 'Section ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    section_id?: number;

    @ApiPropertyOptional({ description: 'Post ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    post_id?: number;

    @ApiPropertyOptional({ description: 'Attachment ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    attachment_id?: number;

    @ApiPropertyOptional({ description: 'Title', example: 'Sample Title' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ description: 'Original Name', example: 'Sample Original Name' })
    @IsOptional()
    @IsString()
    original_name?: string;

    @ApiPropertyOptional({ description: 'Valid flag', example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    flag_valid?: boolean;
}

export interface QALiveStartEvent {
    type: 'QA_LIVE_STARTED';
    payload: {
        qa_live_id: number;
        section_id: number;
        live_by?: number;
        started_at: Date;
    };
}

export interface QALiveEndEvent {
    type: 'QA_LIVE_ENDED';
    payload: {
        qa_live_id: number;
        section_id: number;
        live_by?: number;
        ended_at: Date;
    };
}

export interface FileChangeEvent {
    type: 'FILE_CHANGED';
    payload: {
        qa_live_id: number;
        section_id?: number;
        post_id: number;
        attachment_id: number;
        opened_at: Date;
    };
}




