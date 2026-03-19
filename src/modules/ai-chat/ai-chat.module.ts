import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiChat } from './entities/ai-chat.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [TypeOrmModule.forFeature([AiChat, AiMessage]), forwardRef(() => AiModule)],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}
