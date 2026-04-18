import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';
import { UserSysChatNormalize } from './entities/user-sys-chat-normalize.entity';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { BullMQModule } from 'src/common/bullmq/bullmq.module';

@Module({
  imports: [TypeOrmModule.forFeature([Chat, Message, UserSysChatNormalize]), FileStorageModule, BullMQModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule { }
