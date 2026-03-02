import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleCommunityBookmarkDto {
  @ApiProperty()
  @IsNumber()
  post_commu_id: number;
}
