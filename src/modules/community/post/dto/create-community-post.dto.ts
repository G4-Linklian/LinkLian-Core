import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Length } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCommunityPostDto {

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  community_id: number;

  @ApiProperty({ example: 'โพสต์พร้อมไฟล์แนบ' })
  @IsString()
  @Length(1, 1000)
  content: string;
}
