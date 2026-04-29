import { IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SearchUpvoteDto {
    @ApiPropertyOptional({ description: 'QA Question ID', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    qa_question_id?: number;

    @ApiPropertyOptional({ description: 'Voter ID (User ID)', example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    voter_id?: number;

    @ApiPropertyOptional({ description: 'Flag Valid', example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    flag_valid?: boolean;
}

export class CreateUpvoteDto {
    @ApiProperty({ description: 'QA Question ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    qa_question_id!: number;

    @ApiProperty({ description: 'Voter ID (User ID)', example: 1 })
    @Type(() => Number)
    @IsInt()
    voter_id!: number;
}

export class DeleteUpvoteDto {
    @ApiProperty({ description: 'QA Question ID', example: 1 })
    @Type(() => Number)
    @IsInt()
    qa_question_id!: number;

    @ApiProperty({ description: 'Voter ID (User ID)', example: 1 })
    @Type(() => Number)
    @IsInt()
    voter_id!: number;
}

export interface QAUpvotedEvent {
    type: 'QA_UPVOTED';
    payload: {
        qa_question_id: number;
        qa_live_id: number;
        upvote_count: number;
    };
}

