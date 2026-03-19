import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class ClearChatSessionDto {
  @ApiProperty({ description: 'AI chat ID to clear Redis session keys' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  ai_chat_id!: number;
}
