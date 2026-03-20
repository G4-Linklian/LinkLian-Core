// update-community.dto.ts

import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  is_private?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    }

    return value;
  })
  @IsArray()
  @IsString({ each: true })
  rules?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return [];

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [value];
      }
    }

    return value;
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
