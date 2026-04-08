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

export type CommunityCommentData = {
  type: typeof JobType.COMMUNITY_COMMENT;
  actor_id: number;
  post_id: number;
  post_owner_id: number;
  community_id: number;
};

export type CommunityMemberJoinedData = {
  type: typeof JobType.COMMUNITY_MEMBER_JOINED;
  actor_id: number;
  community_id: number;
  community_name: string;
};

export type CommunityMemberApprovedData = {
  type: typeof JobType.COMMUNITY_MEMBER_APPROVED;
  target_user_id: number;
  community_id: number;
  community_name: string;
  approver_id: number;
  approver_name?: string;
};

export type CommunityJobData =
  | CommunityPostCreatedData
  | CommunityPostUpdatedData
  | CommunityCommentData
  | CommunityMemberJoinedData
  | CommunityMemberApprovedData;

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
      case JobType.COMMUNITY_COMMENT:
        return this.handleComment(job as Job<CommunityCommentData>);
      case JobType.COMMUNITY_MEMBER_JOINED:
        return this.handleMemberJoined(job as Job<CommunityMemberJoinedData>);
      case JobType.COMMUNITY_MEMBER_APPROVED:
        return this.handleMemberApproved(job as Job<CommunityMemberApprovedData>);
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

    const body = `${actorName} โพสต์ ${post_type} ใหม่ใน community`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'post-created',
      feature: 'community',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_id), ref_type: 'community-post' },
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
          ref_id: String(post_id),
          ref_type: 'community-post',
        },
      })),
      sendFCMInBatches(this.dataSource, receiverIds, {
        title, body,
        ref_id: String(post_id),
        ref_type: 'community-post',
        notification_id: String(notificationId),
      }),
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

    const body = `${actorName} อัปเดต ${post_type} ใน community`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'post-updated',
      feature: 'community',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_id), ref_type: 'community-post' },
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
          ref_id: String(post_id),
          ref_type: 'community-post',
        },
      })),
      sendFCMInBatches(this.dataSource, receiverIds, {
        title, body,
        ref_id: String(post_id),
        ref_type: 'community-post',
        notification_id: String(notificationId),
      }),
    ]);

    this.logger.log('Completed', ctx, { post_id, total: receiverIds.length });
  }

  private async handleComment(job: Job<CommunityCommentData>): Promise<void> {
    const { actor_id, post_id, post_owner_id } = job.data;
    const ctx = 'CommunityWorker:comment';

    if (actor_id === post_owner_id) return;

    const actorName = await getActorName(this.dataSource, actor_id);
    const title = 'มีคอมเมนต์ใหม่';
    const body = `${actorName} แสดงความคิดเห็นในโพสต์ community ของคุณ`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'comment',
      feature: 'community',
      notiData: { title, body, actor_name: actorName, ref_id: String(post_id), ref_type: 'community-post' },
    });

    await saveReceivers(this.dataSource, notificationId, [post_owner_id]);
    await job.updateProgress(50);

    await Promise.all([
      this.rabbitmq.publish('linklian_events', 'notification.send', {
        type: 'NOTIFICATION',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(post_owner_id),
          actor_id: String(actor_id),
          actor_name: actorName,
          title,
          body,
          ref_id: String(post_id),
          ref_type: 'community-post',
        },
      }),
      sendFCMInBatches(this.dataSource, [post_owner_id], {
        title, body,
        ref_id: String(post_id),
        ref_type: 'community-post',
        notification_id: String(notificationId),
      }),
    ]);

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { post_id });
  }

  private async handleMemberJoined(job: Job<CommunityMemberJoinedData>): Promise<void> {
    const { actor_id, community_id, community_name } = job.data;
    const ctx = 'CommunityWorker:member-joined';

    const [actorName, ownerIds] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getCommunityOwners(community_id),
    ]);

    if (ownerIds.length === 0) return;

    const title = 'สมาชิกใหม่ขอเข้าร่วม';
    const body = `${actorName} ขอเข้าร่วม ${community_name}`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'member-joined',
      feature: 'community',
      notiData: { title, body, actor_name: actorName, ref_id: String(community_id), ref_type: 'community' },
    });

    await saveReceivers(this.dataSource, notificationId, ownerIds);
    await job.updateProgress(50);

    await Promise.all([
      ...ownerIds.map((ownerId) =>
        this.rabbitmq.publish('linklian_events', 'notification.send', {
          type: 'NOTIFICATION',
          payload: {
            notification_id: String(notificationId),
            receive_user_id: String(ownerId),
            actor_id: String(actor_id),
            actor_name: actorName,
            title,
            body,
            ref_id: String(community_id),
            ref_type: 'community',
          },
        }),
      ),
      sendFCMInBatches(this.dataSource, ownerIds, {
        title, body,
        ref_id: String(community_id),
        ref_type: 'community',
        notification_id: String(notificationId),
      }),
    ]);

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { community_id, actor_id });
  }

  private async handleMemberApproved(job: Job<CommunityMemberApprovedData>): Promise<void> {
    const { target_user_id, community_id, community_name, approver_id, approver_name } = job.data;
    const ctx = 'CommunityWorker:member-approved';

    const resolvedApproverName = approver_name ?? await getActorName(this.dataSource, approver_id);
    const title = 'คำขอเข้าร่วมได้รับการอนุมัติ';
    const body = `คุณได้รับการอนุมัติให้เข้าร่วม ${community_name}`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: approver_id,
      type: 'member-approved',
      feature: 'community',
      notiData: { title, body, actor_name: resolvedApproverName, ref_id: String(community_id), ref_type: 'community' },
    });

    await saveReceivers(this.dataSource, notificationId, [target_user_id]);
    await job.updateProgress(50);

    await Promise.all([
      this.rabbitmq.publish('linklian_events', 'notification.send', {
        type: 'NOTIFICATION',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(target_user_id),
          actor_id: String(approver_id),
          actor_name: resolvedApproverName,
          title,
          body,
          ref_id: String(community_id),
          ref_type: 'community',
        },
      }),
      sendFCMInBatches(this.dataSource, [target_user_id], {
        title, body,
        ref_id: String(community_id),
        ref_type: 'community',
        notification_id: String(notificationId),
      }),
    ]);

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { community_id, target_user_id });
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

  private async getCommunityOwners(communityId: number): Promise<number[]> {
    const rows = await this.dataSource.query(
      `SELECT user_sys_id AS user_id
       FROM community_member
       WHERE community_id = $1
         AND role = 'owner'
         AND status = 'active'
         AND flag_valid = true`,
      [communityId],
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }
}
