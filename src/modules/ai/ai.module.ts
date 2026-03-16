import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PostModule } from '../social-feed/post/post.module';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { AiRedisService } from './redis/ai-redis.service';

@Module({
    imports: [PostModule, forwardRef(() => AiChatModule)],
    controllers: [AiController],
    providers: [AiService, AiRedisService],
    exports: [AiService],
})
export class AiModule { }
