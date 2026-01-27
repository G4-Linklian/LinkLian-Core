// building.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

/**
 * DTO for searching buildings with filters and pagination
 */
export class SearchBuildingDto {
  @ApiPropertyOptional({ description: 'Building ID', example: 1 })
  @IsOptional() 
  @Type(() => Number) 
  @IsInt() 
  building_id?: number;

  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional() 
  @Type(() => Number) 
  @IsInt() 
  inst_id?: number;

  @ApiPropertyOptional({ description: 'Building number', example: 'A1' })
  @IsOptional() @IsString() building_no?: string;

  @ApiPropertyOptional({ description: 'Building name', example: 'Main Building' })
  @IsOptional() @IsString() building_name?: string;

  @ApiPropertyOptional({ description: 'Remark', example: 'Near parking lot' })
  @IsOptional() @IsString() remark?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional() 
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() 
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'building_name' })
  @IsOptional() @IsString() sort_by?: string;

  @ApiPropertyOptional({ description: 'Sort order', example: 'ASC', enum: ['ASC', 'DESC'] })
  @IsOptional() @IsString() sort_order?: 'ASC' | 'DESC';

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

/**
 * DTO for creating a new building
 */
export class CreateBuildingDto {
  @ApiProperty({ description: 'Institution ID', example: 1 })
  @IsInt() inst_id: number;

  @ApiProperty({ description: 'Building number', example: 'A1' })
  @IsString() building_no: string;

  @ApiProperty({ description: 'Building name', example: 'Main Building' })
  @IsString() building_name: string;

  @ApiPropertyOptional({ description: 'Remark', example: 'Near parking lot' })
  @IsOptional() @IsString() remark?: string;
}

/**
 * DTO for updating an existing building
 */
export class UpdateBuildingDto {
  @ApiPropertyOptional({ description: 'Institution ID', example: 1 })
  @IsOptional() @IsInt() inst_id?: number;

  @ApiPropertyOptional({ description: 'Building number', example: 'A1' })
  @IsOptional() @IsString() building_no?: string;

  @ApiPropertyOptional({ description: 'Building name', example: 'Main Building' })
  @IsOptional() @IsString() building_name?: string;

  @ApiPropertyOptional({ description: 'Remark', example: 'Near parking lot' })
  @IsOptional() @IsString() remark?: string;

  @ApiPropertyOptional({ description: 'Room format', example: 'A-{floor}{room}' })
  @IsOptional() @IsString() room_format?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional() @IsBoolean() flag_valid?: boolean;
}
