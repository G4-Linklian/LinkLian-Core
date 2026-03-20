import { IsNumber } from 'class-validator';

export class JoinCommunityDto {
  @IsNumber()
  community_id: number;
}
