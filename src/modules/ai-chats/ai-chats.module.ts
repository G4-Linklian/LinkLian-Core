// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { AiChatController } from './ai-chat.controller';
// import { AiChatService } from './ai-chat.service';
// import { AiChat } from './entities/ai-chat.entity';
// //import { Quiz } from './entities/quiz.entity';


// // @Module({
// //   imports: [TypeOrmModule.forFeature([AiChat, Quiz])],
// //   controllers: [AiChatController],
// //   providers: [AiChatService],
// // })
// // export class AiChatModule {}
// @Module({
//   imports: [TypeOrmModule.forFeature([AiChat])],
//   controllers: [AiChatController],
//   providers: [AiChatService],
//   exports: [AiChatService],
// })
// export class AiChatModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiChat } from './entities/ai-chat.entity';
import { AiModule } from '../ai/ai.module';   // ⭐ เพิ่ม

@Module({
  imports: [
    TypeOrmModule.forFeature([AiChat]),
    AiModule,   // ⭐ เพิ่มตรงนี้
  ],
  controllers: [AiChatController],
  providers: [AiChatService],
  exports: [AiChatService],
})
export class AiChatModule {}