import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/common/logger/logger.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [LoggerModule],
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
