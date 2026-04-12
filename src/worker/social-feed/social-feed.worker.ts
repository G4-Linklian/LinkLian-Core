import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { JobType } from '../worker.constants';
import {
  getActorName,
  saveNotification,
  saveReceivers,
  publishInBatches,
} from '../utils/notification.utils';
import { sendFCMInBatches } from '../utils/fcm.utils';

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

export type SocialFeedJobData =
  | SocialFeedPostCreatedData
  | SocialFeedPostUpdatedData
  | SocialFeedCommentData;

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
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private async handlePostCreated(job: Job<SocialFeedPostCreatedData>): Promise<void> {
    const { actor_id, post_content_id, post_type, title, section_ids } = job.data;
    const ctx = 'SocialFeedWorker:post-created';

    const [actorName, receiverIds, postContent] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getReceiversFromSections(section_ids, actor_id),
      this.getPostContent(this.dataSource, post_content_id),
    ]);

    if (receiverIds.length === 0) {
      this.logger.log('No receivers, skipping', ctx, { post_content_id });
      return;
    }

    const body = `${actorName} โพสต์ ${post_type}: ${postContent}`;

    // sequential: ต้องได้ notification_id ก่อน ถึงจะบันทึก receivers ได้
    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'post-created',
      feature: 'social-feed',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_content_id), ref_type: 'feed-post', section_id: String(section_ids[0]) },
    });

    await saveReceivers(this.dataSource, notificationId, receiverIds);

    await Promise.all([
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
      })),
      sendFCMInBatches(this.dataSource, receiverIds, {
        title, body,
        actor_id: String(actor_id),
        actor_name: actorName,
        ref_id: String(post_content_id),
        ref_type: 'feed-post',
        feature: 'social-feed',
        notification_id: String(notificationId),
        section_id: String(section_ids[0]),
      }),
    ]);

    this.logger.log('Completed', ctx, { post_content_id, total: receiverIds.length });
  }

  private async handlePostUpdated(job: Job<SocialFeedPostUpdatedData>): Promise<void> {
    const { actor_id, post_content_id, post_type, title, section_ids } = job.data;
    const ctx = 'SocialFeedWorker:post-updated';

    const [actorName, receiverIds, postContent] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getReceiversFromSections(section_ids, actor_id),
      this.getPostContent(this.dataSource, post_content_id),
    ]);

    if (receiverIds.length === 0) {
      this.logger.log('No receivers, skipping', ctx, { post_content_id });
      return;
    }

    const body = `${actorName} อัปเดต ${post_type}: ${postContent}`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'post-updated',
      feature: 'social-feed',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_content_id), ref_type: 'feed-post', section_id: String(section_ids[0]) },
    });

    await saveReceivers(this.dataSource, notificationId, receiverIds);

    await Promise.all([
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
      })),
      sendFCMInBatches(this.dataSource, receiverIds, {
        title, body,
        actor_id: String(actor_id),
        actor_name: actorName,
        ref_id: String(post_content_id),
        ref_type: 'feed-post',
        feature: 'social-feed',
        notification_id: String(notificationId),
        section_id: String(section_ids[0]),
      }),
    ]);

    this.logger.log('Completed', ctx, { post_content_id, total: receiverIds.length });
  }

  private async handleComment(job: Job<SocialFeedCommentData>): Promise<void> {
    const { actor_id, post_content_id, post_owner_id, section_ids } = job.data;
    const ctx = 'SocialFeedWorker:comment';

    const [actorName, educatorIds] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getEducatorsFromSections(section_ids),
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
      notiData: { title, body, actor_name: actorName, ref_id: String(post_content_id), ref_type: 'feed-post', section_id: String(section_ids[0]) },
    });

    await saveReceivers(this.dataSource, notificationId, receiverIds);
    await job.updateProgress(50);

    await Promise.all([
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
      })),
      sendFCMInBatches(this.dataSource, receiverIds, {
        title, body,
        actor_id: String(actor_id),
        actor_name: actorName,
        ref_id: String(post_content_id),
        ref_type: 'feed-post',
        feature: 'social-feed',
        notification_id: String(notificationId),
        section_id: String(section_ids[0]),
      }),
    ]);

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { post_content_id, total: receiverIds.length });
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

  private async getPostContent(dataSource: DataSource, postContentId: number): Promise<string> {
    const rows = await dataSource.query(
      `SELECT content FROM post_content WHERE post_content_id = $1`,
      [postContentId],
    );
    return rows[0]?.content ?? '';
  }

  private async getReceiversFromSections(
    sectionIds: number[],
    excludeActorId: number,
  ): Promise<number[]> {
    if (sectionIds.length === 0) return [];

    const placeholders = sectionIds.map((_, i) => `$${i + 2}`).join(', ');
    const rows = await this.dataSource.query(
      `SELECT DISTINCT user_id FROM (
         -- นักเรียนใน section
         SELECT e.student_id AS user_id
         FROM enrollment e
         JOIN user_sys u ON e.student_id = u.user_sys_id
           AND u.flag_valid = true AND u.user_status = 'Active'
         WHERE e.section_id IN (${placeholders})
           AND e.flag_valid = true AND e.student_id IS NOT NULL

         UNION

         -- ครูใน section
         SELECT se.educator_id AS user_id
         FROM section_educator se
         JOIN user_sys u ON se.educator_id = u.user_sys_id
           AND u.flag_valid = true AND u.user_status = 'Active'
         WHERE se.section_id IN (${placeholders})
           AND se.flag_valid = true
       ) AS receivers
       WHERE user_id != $1`,
      [excludeActorId, ...sectionIds],
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }
}
