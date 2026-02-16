// room-location.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

/**
 * DTO for searching room locations with filters and pagination
 */
export class SearchRoomLocationDto {
  @ApiPropertyOptional({ description: 'Room location ID', example: 1 })
  @IsOptional() 
  @Type(() => Number) 
  @IsInt() 
  room_location_id?: number;

  @ApiPropertyOptional({ description: 'Building ID', example: 1 })
  @IsOptional() 
  @Type(() => Number) 
  @IsInt() 
  building_id?: number;

  @ApiPropertyOptional({ description: 'Room number', example: '101' })
  @IsOptional() @IsString() room_number?: string;

  @ApiPropertyOptional({ description: 'Room remark', example: 'Conference room' })
  @IsOptional() @IsString() room_remark?: string;

  @ApiPropertyOptional({ description: 'Floor', example: '1' })
  @IsOptional() @IsString() floor?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional() 
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() 
  flag_valid?: boolean;

  @ApiPropertyOptional({ description: 'Sort by field', example: 'room_number' })
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
 * DTO for creating a new room location
 */
export class CreateRoomLocationDto {
  @ApiProperty({ description: 'Building ID', example: 1 })
  @IsInt() building_id!: number;

  @ApiProperty({ description: 'Room number', example: '101' })
  @IsString() room_number!: string;

  @ApiPropertyOptional({ description: 'Room remark', example: 'Conference room' })
  @IsOptional() @IsString() room_remark?: string;

  @ApiProperty({ description: 'Floor', example: '1' })
  @IsString() floor!: string;
}

/**
 * DTO for batch creating room locations
 */
export class CreateRoomLocationBatchDto {
  @ApiProperty({ 
    description: 'Array of room locations to create', 
    type: [CreateRoomLocationDto],
    example: [
      { building_id: 1, room_number: '101', floor: '1', room_remark: 'Office' },
      { building_id: 1, room_number: '102', floor: '1', room_remark: 'Meeting room' }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRoomLocationDto)
  rooms!: CreateRoomLocationDto[];
}

/**
 * DTO for updating an existing room location
 */
export class UpdateRoomLocationDto {
  @ApiPropertyOptional({ description: 'Building ID', example: 1 })
  @IsOptional() @IsInt() building_id?: number;

  @ApiPropertyOptional({ description: 'Room number', example: '101' })
  @IsOptional() @IsString() room_number?: string;

  @ApiPropertyOptional({ description: 'Room remark', example: 'Conference room' })
  @IsOptional() @IsString() room_remark?: string;

  @ApiPropertyOptional({ description: 'Floor', example: '1' })
  @IsOptional() @IsString() floor?: string;

  @ApiPropertyOptional({ description: 'Valid flag', example: true })
  @IsOptional() @IsBoolean() flag_valid?: boolean;
}
