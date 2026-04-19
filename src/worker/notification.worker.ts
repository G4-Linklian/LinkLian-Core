import { Injectable, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { BullMQService } from '../common/bullmq/bullmq.service';
import { AppLogger } from '../common/logger/app-logger.service';
import { NOTIFICATION_QUEUE, WORKER_CONCURRENCY, JobType } from './worker.constants';
import { SocialFeedWorker, SocialFeedJobData } from './social-feed/social-feed.worker';
import { CommunityWorker, CommunityJobData } from './community/community.worker';
import { QnaWorker, QnaJobData } from './qna/qna.worker';

// ─── Union ของ Job ทั้งหมด ────────────────────────────────────────────────────

export type NotificationJobData =
  | SocialFeedJobData
  | CommunityJobData
  | QnaJobData;

// ─── Main Dispatcher Worker ───────────────────────────────────────────────────

@Injectable()
export class NotificationWorker implements OnModuleInit {
  constructor(
    private readonly bullmq: BullMQService,
    private readonly socialFeedWorker: SocialFeedWorker,
    private readonly communityWorker: CommunityWorker,
    private readonly qnaWorker: QnaWorker,
    private readonly logger: AppLogger,
  ) {}

  onModuleInit() {
    this.bullmq.registerWorker<NotificationJobData>(
      NOTIFICATION_QUEUE,
      (job) => this.dispatch(job),
      { concurrency: WORKER_CONCURRENCY },
    );
    this.logger.log('NotificationWorker registered', 'NotificationWorker', {
      queue: NOTIFICATION_QUEUE,
      concurrency: WORKER_CONCURRENCY,
    });
  }

  /**
   * Dispatcher: ดู job.data.type แล้วส่งไปยัง sub-worker ที่ถูกต้อง
   * เพิ่ม job type ใหม่ได้โดยเพิ่ม case เดียว
   */
  private async dispatch(job: Job<NotificationJobData>): Promise<void> {
    const { type } = job.data;

    this.logger.log('Dispatching job', 'NotificationWorker', { type, jobId: job.id });

    switch (type) {
      // ── Social Feed ──────────────────────────────────────────────────────
      case JobType.SOCIAL_FEED_POST_CREATED:
      case JobType.SOCIAL_FEED_POST_UPDATED:
      case JobType.SOCIAL_FEED_COMMENT:
        return this.socialFeedWorker.handle(job as Job<SocialFeedJobData>);

      // ── Community ────────────────────────────────────────────────────────
      case JobType.COMMUNITY_POST_CREATED:
      case JobType.COMMUNITY_POST_UPDATED:
      case JobType.COMMUNITY_COMMENT:
      case JobType.COMMUNITY_MEMBER_JOINED:
      case JobType.COMMUNITY_MEMBER_APPROVED:
        return this.communityWorker.handle(job as Job<CommunityJobData>);

      // ── QnA ──────────────────────────────────────────────────────────────
      case JobType.QNA_LIVE_STARTED:
      case JobType.QNA_QUESTION_CREATED:
      case JobType.QNA_QUESTION_UPDATED:
        return this.qnaWorker.handle(job as Job<QnaJobData>);

      // ── Unknown ──────────────────────────────────────────────────────────
      default:
        this.logger.warn('Unknown job type, skipping', 'NotificationWorker', {
          type,
          jobId: job.id,
        });
    }
  }
}
