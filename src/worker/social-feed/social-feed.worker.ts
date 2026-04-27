import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { JobType, RABBITMQ_ROUTING_KEY_SOCKET, RABBITMQ_ROUTING_KEY_FIREBASE } from '../worker.constants';
import {
  getActorName,
  saveNotification,
  saveReceivers,
  publishInBatches,
  getMembersFromSections,
  translatePostType,
} from '../utils/notification.utils';

// ─── Job Payload Types ────────────────────────────────────────────────────────

export type SocialFeedPostCreatedData = {
  type: typeof JobType.SOCIAL_FEED_POST_CREATED;
  actor_id: number;
  post_content_id: number;
  post_type: string;
  title: string;
  section_ids: number[];
};

export type SocialFeedPostUpdatedData = {
  type: typeof JobType.SOCIAL_FEED_POST_UPDATED;
  actor_id: number;
  post_content_id: number;
  post_type: string;
  title: string;
  section_ids: number[];
};

export type SocialFeedJobData =
  | SocialFeedPostCreatedData
  | SocialFeedPostUpdatedData;

// ─── Worker ───────────────────────────────────────────────────────────────────

@Injectable()
export class SocialFeedWorker {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  async handle(job: Job<SocialFeedJobData>): Promise<void> {
    await job.updateProgress(0);

    switch (job.data.type) {
      case JobType.SOCIAL_FEED_POST_CREATED:
        return this.handlePostCreated(job as Job<SocialFeedPostCreatedData>);
      case JobType.SOCIAL_FEED_POST_UPDATED:
        return this.handlePostUpdated(job as Job<SocialFeedPostUpdatedData>);
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private async handlePostCreated(job: Job<SocialFeedPostCreatedData>): Promise<void> {
    const { actor_id, post_content_id, post_type, title, section_ids } = job.data;
    const ctx = 'SocialFeedWorker:post-created';

    const [actorName, receiverIds, postContent, daysUntilDeadline] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      getMembersFromSections(this.dataSource, section_ids, actor_id),
      this.getPostContent(this.dataSource, post_content_id),
      post_type === 'assignment' ? this.getAssignmentDeadlineDays(post_content_id) : Promise.resolve(undefined),
    ]);

    if (receiverIds.length === 0) {
      this.logger.log('No receivers, skipping', ctx, { post_content_id });
      return;
    }

    const body = `${actorName} โพสต์ ${translatePostType(post_type)}: ${postContent}`;

    // sequential: ต้องได้ notification_id ก่อน ถึงจะบันทึก receivers ได้
    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'post-created',
      feature: 'social-feed',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_content_id), ref_type: 'feed-post', section_id: String(section_ids[0]), post_type, days_until_deadline: daysUntilDeadline },
    });

    await saveReceivers(this.dataSource, notificationId, receiverIds);

    await Promise.all([
      // Foreground: Socket → WebSocket banner
      publishInBatches(this.rabbitmq, job, receiverIds, (userId) => ({
        type: 'NOTIFICATION',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(userId),
          actor_id: String(actor_id),
          actor_name: actorName,
          title,
          body,
          ref_id: String(post_content_id),
          ref_type: 'feed-post',
          feature: 'social-feed',
          section_id: String(section_ids[0]),
        },
      }), RABBITMQ_ROUTING_KEY_SOCKET),
      // Background: FCMConsumer → Firebase push notification
      publishInBatches(this.rabbitmq, job, receiverIds, (userId) => ({
        type: 'FCM_SEND',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(userId),
          actor_id: String(actor_id),
          actor_name: actorName,
          title,
          body,
          ref_id: String(post_content_id),
          ref_type: 'feed-post',
          feature: 'social-feed',
          section_id: String(section_ids[0]),
        },
      }), RABBITMQ_ROUTING_KEY_FIREBASE),
    ]);

    this.logger.log('Completed', ctx, { post_content_id, total: receiverIds.length });
  }

  private async handlePostUpdated(job: Job<SocialFeedPostUpdatedData>): Promise<void> {
    const { actor_id, post_content_id, post_type, title, section_ids } = job.data;
    const ctx = 'SocialFeedWorker:post-updated';

    const [actorName, receiverIds, postContent, daysUntilDeadline] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      getMembersFromSections(this.dataSource, section_ids, actor_id),
      this.getPostContent(this.dataSource, post_content_id),
      post_type === 'assignment' ? this.getAssignmentDeadlineDays(post_content_id) : Promise.resolve(undefined),
    ]);

    if (receiverIds.length === 0) {
      this.logger.log('No receivers, skipping', ctx, { post_content_id });
      return;
    }

    const body = `${actorName} อัปเดต ${translatePostType(post_type)}: ${postContent}`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'post-updated',
      feature: 'social-feed',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_content_id), ref_type: 'feed-post', section_id: String(section_ids[0]), post_type, days_until_deadline: daysUntilDeadline },
    });

    await saveReceivers(this.dataSource, notificationId, receiverIds);

    await Promise.all([
      // Foreground: Socket → WebSocket banner
      publishInBatches(this.rabbitmq, job, receiverIds, (userId) => ({
        type: 'NOTIFICATION',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(userId),
          actor_id: String(actor_id),
          actor_name: actorName,
          title,
          body,
          ref_id: String(post_content_id),
          ref_type: 'feed-post',
          feature: 'social-feed',
          section_id: String(section_ids[0]),
        },
      }), RABBITMQ_ROUTING_KEY_SOCKET),
      // Background: FCMConsumer → Firebase push notification
      publishInBatches(this.rabbitmq, job, receiverIds, (userId) => ({
        type: 'FCM_SEND',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(userId),
          actor_id: String(actor_id),
          actor_name: actorName,
          title,
          body,
          ref_id: String(post_content_id),
          ref_type: 'feed-post',
          feature: 'social-feed',
          section_id: String(section_ids[0]),
        },
      }), RABBITMQ_ROUTING_KEY_FIREBASE),
    ]);

    this.logger.log('Completed', ctx, { post_content_id, total: receiverIds.length });
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  private async getAssignmentDeadlineDays(postContentId: number): Promise<number | undefined> {
    const rows = await this.dataSource.query(
      `SELECT due_date FROM assignment WHERE post_id = $1 AND flag_valid = true LIMIT 1`,
      [postContentId],
    );
    if (!rows[0]?.due_date) return undefined;
    const days = Math.ceil((new Date(rows[0].due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  }

  private async getPostContent(dataSource: DataSource, postContentId: number): Promise<string> {
    const rows = await dataSource.query(
      `SELECT content FROM post_content WHERE post_content_id = $1`,
      [postContentId],
    );
    return rows[0]?.content ?? '';
  }

}
