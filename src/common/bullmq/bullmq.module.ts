import { Global, Module } from '@nestjs/common';
import { BullMQService } from './bullmq.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [BullMQService],
  exports: [BullMQService],
})
export class BullMQModule {}
