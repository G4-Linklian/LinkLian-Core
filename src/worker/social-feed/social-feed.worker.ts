import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { JobType, RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_SOCKET, RABBITMQ_ROUTING_KEY_FIREBASE } from '../worker.constants';
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

export type SocialFeedCommentData = {
  type: typeof JobType.SOCIAL_FEED_COMMENT;
  actor_id: number;
  post_content_id: number;
  post_owner_id: number;
  section_ids: number[];
};

export type SocialFeedCommentReplyData = {
  type: typeof JobType.SOCIAL_FEED_COMMENT_REPLY;
  actor_id: number;
  post_content_id: number;
  parent_comment_id: number;
  parent_owner_id: number;
  section_ids: number[];
};

export type SocialFeedJobData =
  | SocialFeedPostCreatedData
  | SocialFeedPostUpdatedData
  | SocialFeedCommentData
  | SocialFeedCommentReplyData;

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
      case JobType.SOCIAL_FEED_COMMENT:
        return this.handleComment(job as Job<SocialFeedCommentData>);
      case JobType.SOCIAL_FEED_COMMENT_REPLY:
        return this.handleCommentReply(job as Job<SocialFeedCommentReplyData>);
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

  private async handleComment(job: Job<SocialFeedCommentData>): Promise<void> {
    const { actor_id, post_content_id, post_owner_id, section_ids } = job.data;
    const ctx = 'SocialFeedWorker:comment';

    const [actorName, educatorIds, postTitle] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getEducatorsFromSections(section_ids),
      this.getPostContent(this.dataSource, post_content_id),
    ]);

    // รวม post_owner + ครูใน section แล้วกรอง actor ออก
    const receiverSet = new Set([post_owner_id, ...educatorIds]);
    receiverSet.delete(actor_id);
    const receiverIds = Array.from(receiverSet);

    if (receiverIds.length === 0) return;

    const title = 'มีคอมเมนต์ใหม่';
    const body = `${actorName} แสดงความคิดเห็นในโพสต์`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'comment',
      feature: 'social-feed',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_content_id), ref_type: 'feed-post', section_id: String(section_ids[0]), post_title: postTitle },
    });

    await saveReceivers(this.dataSource, notificationId, receiverIds);
    await job.updateProgress(50);

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

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { post_content_id, total: receiverIds.length });
  }

  private async handleCommentReply(job: Job<SocialFeedCommentReplyData>): Promise<void> {
    const { actor_id, post_content_id, parent_comment_id, parent_owner_id, section_ids } = job.data;
    const ctx = 'SocialFeedWorker:comment-reply';

    // ไม่แจ้งเตือนถ้า reply ตัวเอง
    if (actor_id === parent_owner_id) return;

    const [actorName, postTitle] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getPostContent(this.dataSource, post_content_id),
    ]);

    const title = 'มีการตอบกลับความคิดเห็นของคุณ';
    const body = `${actorName} ตอบกลับความคิดเห็นของคุณ`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'comment-reply',
      feature: 'social-feed',
      notiData: {
        title,
        body,
        actor_name: actorName,
        ref_id: String(post_content_id),
        ref_type: 'feed-comment',
        section_id: String(section_ids[0]),
        post_title: postTitle,
      },
    });

    await saveReceivers(this.dataSource, notificationId, [parent_owner_id]);
    await job.updateProgress(50);

    const notificationPayload = {
      notification_id: String(notificationId),
      receive_user_id: String(parent_owner_id),
      actor_id: String(actor_id),
      actor_name: actorName,
      title,
      body,
      ref_id: String(post_content_id),
      ref_type: 'feed-comment',
      feature: 'social-feed',
      section_id: String(section_ids[0]),
    };

    await Promise.all([
      // Foreground: Socket → WebSocket banner
      this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_SOCKET, {
        type: 'NOTIFICATION',
        payload: notificationPayload,
      }),
      // Background: FCMConsumer → Firebase push notification
      this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE, {
        type: 'FCM_SEND',
        payload: notificationPayload,
      }),
    ]);

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { post_content_id, parent_comment_id });
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  private async getEducatorsFromSections(sectionIds: number[]): Promise<number[]> {
    if (sectionIds.length === 0) return [];
    const placeholders = sectionIds.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this.dataSource.query(
      `SELECT DISTINCT se.educator_id AS user_id
       FROM section_educator se
       JOIN user_sys u ON se.educator_id = u.user_sys_id
         AND u.flag_valid = true AND u.user_status = 'Active'
       WHERE se.section_id IN (${placeholders}) AND se.flag_valid = true`,
      [...sectionIds],
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }

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
