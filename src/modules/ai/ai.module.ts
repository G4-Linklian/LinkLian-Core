import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PostModule } from '../social-feed/post/post.module';

@Module({
    imports: [PostModule],
    controllers: [AiController],
    providers: [AiService],
    exports: [AiService],
})
export class AiModule { }
