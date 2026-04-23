import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import {
  RABBITMQ_EXCHANGE,
  RABBITMQ_ROUTING_KEY_SOCKET,
  RABBITMQ_ROUTING_KEY_FIREBASE,
} from 'src/worker/worker.constants';
import {
  getActorName,
  saveNotification,
  saveReceivers,
} from 'src/worker/utils/notification.utils';

@Injectable()
export class CommunityCommentNotificationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: AppLogger,
  ) {}

  async notifyComment(params: {
    actorId: number;
    postId: number;
    postOwnerId: number;
    communityId: number;
  }): Promise<void> {
    const { actorId, postId, postOwnerId, communityId } = params;
    if (!postOwnerId || actorId === postOwnerId) return;

    try {
      const [actorName, postTitle] = await Promise.all([
        getActorName(this.dataSource, actorId),
        this.getCommunityPostContent(postId),
      ]);

      const title = 'มีคอมเมนต์ใหม่';
      const body = `${actorName} แสดงความคิดเห็นในโพสต์ community ของคุณ`;

      const notificationId = await saveNotification(this.dataSource, {
        actorId,
        type: 'comment',
        feature: 'community',
        notiData: {
          title,
          body,
          actor_name: actorName,
          ref_id: String(postId),
          ref_type: 'community-post',
          community_id: String(communityId),
          post_title: postTitle,
        },
      });

      await saveReceivers(this.dataSource, notificationId, [postOwnerId]);

      const payload = {
        notification_id: String(notificationId),
        receive_user_id: String(postOwnerId),
        actor_id: String(actorId),
        actor_name: actorName,
        title,
        body,
        ref_id: String(postId),
        ref_type: 'community-post',
        feature: 'community',
        community_id: String(communityId),
      };

      await Promise.all([
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_SOCKET, {
          type: 'NOTIFICATION',
          payload,
        }),
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE, {
          type: 'FCM_SEND',
          payload,
        }),
      ]);
    } catch (error) {
      this.logger.error(
        'Community comment notification failed (delivery unaffected)',
        'CommunityCommentNotificationService',
        error,
      );
    }
  }

  async notifyCommentReply(params: {
    actorId: number;
    postId: number;
    parentOwnerId: number;
    communityId: number;
  }): Promise<void> {
    const { actorId, postId, parentOwnerId, communityId } = params;
    if (actorId === parentOwnerId) return;

    try {
      const actorName = await getActorName(this.dataSource, actorId);

      const title = 'มีการตอบกลับความคิดเห็นของคุณ';
      const body = `${actorName} ตอบกลับความคิดเห็นของคุณ`;

      const notificationId = await saveNotification(this.dataSource, {
        actorId,
        type: 'comment-reply',
        feature: 'community',
        notiData: {
          title,
          body,
          actor_name: actorName,
          ref_id: String(postId),
          ref_type: 'community-comment',
          community_id: String(communityId),
        },
      });

      await saveReceivers(this.dataSource, notificationId, [parentOwnerId]);

      const payload = {
        notification_id: String(notificationId),
        receive_user_id: String(parentOwnerId),
        actor_id: String(actorId),
        actor_name: actorName,
        title,
        body,
        ref_id: String(postId),
        ref_type: 'community-comment',
        feature: 'community',
        community_id: String(communityId),
      };

      await Promise.all([
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_SOCKET, {
          type: 'NOTIFICATION',
          payload,
        }),
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE, {
          type: 'FCM_SEND',
          payload,
        }),
      ]);
    } catch (error) {
      this.logger.error(
        'Community comment reply notification failed (delivery unaffected)',
        'CommunityCommentNotificationService',
        error,
      );
    }
  }

  async notifyMemberJoined(params: {
    actorId: number;
    communityId: number;
    communityName: string;
  }): Promise<void> {
    const { actorId, communityId, communityName } = params;

    try {
      const [actorName, ownerIds] = await Promise.all([
        getActorName(this.dataSource, actorId),
        this.getCommunityOwner(communityId),
      ]);

      if (ownerIds.length === 0) return;

      const title = 'สมาชิกใหม่ขอเข้าร่วม';
      const body = `${actorName} ขอเข้าร่วม ${communityName}`;

      const notificationId = await saveNotification(this.dataSource, {
        actorId,
        type: 'member-joined',
        feature: 'community',
        notiData: {
          title,
          body,
          actor_name: actorName,
          ref_id: String(communityId),
          ref_type: 'community',
        },
      });

      await saveReceivers(this.dataSource, notificationId, ownerIds);

      const payload = {
        notification_id: String(notificationId),
        receive_user_id: String(ownerIds[0]),
        actor_id: String(actorId),
        actor_name: actorName,
        title,
        body,
        ref_id: String(communityId),
        ref_type: 'community',
        feature: 'community',
      };

      await Promise.all([
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_SOCKET, {
          type: 'NOTIFICATION',
          payload,
        }),
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE, {
          type: 'FCM_SEND',
          payload,
        }),
      ]);
    } catch (error) {
      this.logger.error(
        'Community member joined notification failed (delivery unaffected)',
        'CommunityCommentNotificationService',
        error,
      );
    }
  }

  async notifyMemberApproved(params: {
    targetUserId: number;
    communityId: number;
    communityName: string;
    approverId: number;
  }): Promise<void> {
    const { targetUserId, communityId, communityName, approverId } = params;

    try {
      const approverName = await getActorName(this.dataSource, approverId);

      const title = 'คำขอเข้าร่วมได้รับการอนุมัติ';
      const body = `คุณได้รับการอนุมัติให้เข้าร่วม ${communityName}`;

      const notificationId = await saveNotification(this.dataSource, {
        actorId: approverId,
        type: 'member-approved',
        feature: 'community',
        notiData: {
          title,
          body,
          actor_name: approverName,
          ref_id: String(communityId),
          ref_type: 'community',
        },
      });

      await saveReceivers(this.dataSource, notificationId, [targetUserId]);

      const payload = {
        notification_id: String(notificationId),
        receive_user_id: String(targetUserId),
        actor_id: String(approverId),
        actor_name: approverName,
        title,
        body,
        ref_id: String(communityId),
        ref_type: 'community',
        feature: 'community',
      };

      await Promise.all([
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_SOCKET, {
          type: 'NOTIFICATION',
          payload,
        }),
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE, {
          type: 'FCM_SEND',
          payload,
        }),
      ]);
    } catch (error) {
      this.logger.error(
        'Community member approved notification failed (delivery unaffected)',
        'CommunityCommentNotificationService',
        error,
      );
    }
  }

  private async getCommunityPostContent(postId: number): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT content FROM post_in_community WHERE post_commu_id = $1`,
      [postId],
    );
    return rows[0]?.content ?? '';
  }

  private async getCommunityOwner(communityId: number): Promise<number[]> {
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
