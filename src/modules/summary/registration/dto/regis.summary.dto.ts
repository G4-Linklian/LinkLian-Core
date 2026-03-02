// regis.summary.dto.ts
import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for all registration summary endpoints
 * Only requires inst_id as input
 */
export class RegisSummaryDto {
  @ApiProperty({ description: 'Institution ID', example: 10 })
  @Type(() => Number)
  @IsInt()
  inst_id!: number;
}

// Alias for backward compatibility and semantic clarity
export class RegisSummaryInfoDto extends RegisSummaryDto {}
export class RegisSummaryCurriculumDto extends RegisSummaryDto {}

/**
 * DTO for /schedule endpoint - requires semester_id
 */
export class RegisSummaryScheduleDto extends RegisSummaryDto {
  @ApiProperty({ description: 'Semester ID', example: 6 })
  @Type(() => Number)
  @IsInt()
  semester_id!: number;
}

export class RegisSummaryRegistrationDto extends RegisSummaryDto {}
