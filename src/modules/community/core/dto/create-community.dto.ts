import { IsString, IsBoolean, IsArray, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCommunityDto {
  @IsString()
  name: string;

  @IsString()
  description: string;
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return false;
  })
  @IsBoolean()
  is_private: boolean;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  rules: string[];

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((tag) => tag.trim());
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  tags: string[];
}
