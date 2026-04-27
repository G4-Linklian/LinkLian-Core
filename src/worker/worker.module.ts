import { Module } from '@nestjs/common';
import { LoggerModule } from '../common/logger/logger.module';
import { NotificationWorker } from './notification.worker';
import { SocialFeedWorker } from './social-feed/social-feed.worker';
import { CommunityWorker } from './community/community.worker';
import { QnaWorker } from './qna/qna.worker';
import { FCMConsumerService } from './fcm-consumer.service';

@Module({
  imports: [LoggerModule],
  providers: [
    // Main dispatcher
    NotificationWorker,
    // Sub-workers
    SocialFeedWorker,
    CommunityWorker,
    QnaWorker,
    // Background notification consumer (RabbitMQ → Firebase)
    FCMConsumerService,
  ],
})
export class WorkerModule {}
