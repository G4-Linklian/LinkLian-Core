import { Module } from '@nestjs/common';
import { LoggerModule } from '../common/logger/logger.module';
import { NotificationWorker } from './notification.worker';
import { SocialFeedWorker } from './social-feed/social-feed.worker';
import { CommunityWorker } from './community/community.worker';
import { ChatWorker } from './chat/chat.worker';
import { QnaWorker } from './qna/qna.worker';

@Module({
  imports: [LoggerModule],
  providers: [
    // Main dispatcher
    NotificationWorker,
    // Sub-workers
    SocialFeedWorker,
    CommunityWorker,
    ChatWorker,
    QnaWorker,
  ],
})
export class WorkerModule {}
