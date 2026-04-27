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
  translatePostType,
} from '../utils/notification.utils';

// ─── Job Payload Types ────────────────────────────────────────────────────────

export type CommunityPostCreatedData = {
  type: typeof JobType.COMMUNITY_POST_CREATED;
  actor_id: number;
  community_id: number;
  post_id: number;
  post_type: string;
  title: string;
};

export type CommunityPostUpdatedData = {
  type: typeof JobType.COMMUNITY_POST_UPDATED;
  actor_id: number;
  community_id: number;
  post_id: number;
  post_type: string;
  title: string;
};

export type CommunityJobData =
  | CommunityPostCreatedData
  | CommunityPostUpdatedData;

// ─── Worker ───────────────────────────────────────────────────────────────────

@Injectable()
export class CommunityWorker {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  async handle(job: Job<CommunityJobData>): Promise<void> {
    await job.updateProgress(0);

    switch (job.data.type) {
      case JobType.COMMUNITY_POST_CREATED:
        return this.handlePostCreated(job as Job<CommunityPostCreatedData>);
      case JobType.COMMUNITY_POST_UPDATED:
        return this.handlePostUpdated(job as Job<CommunityPostUpdatedData>);
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private async handlePostCreated(job: Job<CommunityPostCreatedData>): Promise<void> {
    const { actor_id, community_id, post_id, post_type, title } = job.data;
    const ctx = 'CommunityWorker:post-created';

    const [actorName, receiverIds] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getCommunityMembers(community_id, actor_id),
    ]);

    if (receiverIds.length === 0) {
      this.logger.log('No receivers, skipping', ctx, { post_id });
      return;
    }

    const body = `${actorName} โพสต์ ${translatePostType(post_type)} ใหม่ใน community`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'post-created',
      feature: 'community',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_id), ref_type: 'community-post', community_id: String(community_id) },
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
          ref_id: String(post_id),
          ref_type: 'community-post',
          feature: 'community',
          community_id: String(community_id),
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
          ref_id: String(post_id),
          ref_type: 'community-post',
          feature: 'community',
          community_id: String(community_id),
        },
      }), RABBITMQ_ROUTING_KEY_FIREBASE),
    ]);

    this.logger.log('Completed', ctx, { post_id, total: receiverIds.length });
  }

  private async handlePostUpdated(job: Job<CommunityPostUpdatedData>): Promise<void> {
    const { actor_id, community_id, post_id, post_type, title } = job.data;
    const ctx = 'CommunityWorker:post-updated';

    const [actorName, receiverIds] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getCommunityMembers(community_id, actor_id),
    ]);

    if (receiverIds.length === 0) {
      this.logger.log('No receivers, skipping', ctx, { post_id });
      return;
    }

    const body = `${actorName} อัปเดต ${translatePostType(post_type)} ใน community`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'post-updated',
      feature: 'community',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_id), ref_type: 'community-post', community_id: String(community_id) },
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
          ref_id: String(post_id),
          ref_type: 'community-post',
          feature: 'community',
          community_id: String(community_id),
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
          ref_id: String(post_id),
          ref_type: 'community-post',
          feature: 'community',
          community_id: String(community_id),
        },
      }), RABBITMQ_ROUTING_KEY_FIREBASE),
    ]);

    this.logger.log('Completed', ctx, { post_id, total: receiverIds.length });
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  private async getCommunityMembers(
    communityId: number,
    excludeActorId: number,
  ): Promise<number[]> {
    const rows = await this.dataSource.query(
      `SELECT cm.user_sys_id AS user_id
       FROM community_member cm
       JOIN user_sys u ON u.user_sys_id = cm.user_sys_id AND u.flag_valid = true
       WHERE cm.community_id = $1
         AND cm.status = 'active'
         AND cm.flag_valid = true
         AND cm.user_sys_id != $2`,
      [communityId, excludeActorId],
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }

}
