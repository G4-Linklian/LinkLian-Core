import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SearchQuestionDto {
    @ApiPropertyOptional({ description: 'QA Question ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    qa_question_id?: number;

    @ApiPropertyOptional({ description: 'QA Live ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    qa_live_id?: number;

    @ApiPropertyOptional({ description: 'Asker ID (User ID)', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    asker_id?: number;

    @ApiPropertyOptional({ description: 'Is Anonymous', example: false })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    is_anonymous?: boolean;

    @ApiPropertyOptional({ description: 'Question text', example: 'What is the deadline?' })
    @IsOptional()
    @IsString()
    question?: string;

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

    @ApiPropertyOptional({ description: 'Slide Number', example: 5 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    slide_number?: number;

    @ApiPropertyOptional({ description: 'Status', example: 'ACTIVE' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Upvote Count', example: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    upvote_count?: number;

    @ApiPropertyOptional({ description: 'Created At', example: '2024-01-01T00:00:00Z' })
    @IsOptional()
    @Type(() => Date)
    created_at?: Date;

    @ApiPropertyOptional({ description: 'Updated At', example: '2024-01-01T01:00:00Z' })
    @IsOptional()
    @Type(() => Date)
    updated_at?: Date;

    @ApiPropertyOptional({ description: 'Flag Valid', example: true })
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

export class CreateQuestionDto {
    @ApiProperty({ description: 'QA Live ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    qa_live_id!: number;

    @ApiPropertyOptional({ description: 'Asker ID (User ID)', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    asker_id?: number;

    @ApiPropertyOptional({ description: 'Is Anonymous', example: false })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    is_anonymous?: boolean;

    @ApiProperty({ description: 'Question text', example: 'What is the deadline?' })
    @IsString()
    question!: string;

    @ApiProperty({ description: 'Post ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    post_id!: number;

    @ApiProperty({ description: 'Attachment ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    attachment_id!: number;

    @ApiProperty({ description: 'Slide Number', example: 5 })
    @Type(() => Number)
    @IsInt()
    slide_number!: number;
}

export class UpdateQuestionDto {
    @ApiPropertyOptional({ description: 'Question text', example: 'What is the deadline?' })
    @IsOptional()
    @IsString()
    question?: string;

    @ApiPropertyOptional({ description: 'Status (e.g., ANSWERED)', example: 'ANSWERED' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Upvote Count', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    upvote_count?: number;

    @ApiPropertyOptional({ description: 'Flag Valid', example: false })
    @IsOptional()
    @IsBoolean()
    flag_valid?: boolean;
}

export interface MaskedAsker {
    user_id: number;
    first_name: string;
    last_name: string;
    profile_pic: string | null;
}

export interface QANewQuestionEvent {
    type: 'QA_NEW_QUESTION';
    payload: {
        qa_question_id: number;
        qa_live_id: number;
        question: string;
        asker: MaskedAsker; 
        post_id: number;
        attachment_id: number;
        slide_number: number;
        status: string; 
        upvote_count: number;
        created_at: Date;
    };
}

export interface QAQuestionUpdatedEvent {
    type: 'QA_QUESTION_UPDATED';
    payload: {
        qa_question_id: number;
        qa_live_id: number;
        question?: string;
        status: string; 
    };
}

