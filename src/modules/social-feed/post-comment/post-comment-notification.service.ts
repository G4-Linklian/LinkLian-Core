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
export class PostCommentNotificationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: AppLogger,
  ) {}

  async notifyComment(params: {
    actorId: number;
    postContentId: number;
    postOwnerId: number;
    sectionIds: number[];
  }): Promise<void> {
    const { actorId, postContentId, postOwnerId, sectionIds } = params;
    if (actorId === postOwnerId) return;

    try {
      const [actorName, postTitle] = await Promise.all([
        getActorName(this.dataSource, actorId),
        this.getPostContent(postContentId),
      ]);

      const title = 'มีคอมเมนต์ใหม่';
      const body = `${actorName} แสดงความคิดเห็นในโพสต์`;

      const notificationId = await saveNotification(this.dataSource, {
        actorId,
        type: 'comment',
        feature: 'social-feed',
        notiData: {
          title,
          body,
          actor_name: actorName,
          ref_id: String(postContentId),
          ref_type: 'feed-post',
          section_id: String(sectionIds[0]),
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
        ref_id: String(postContentId),
        ref_type: 'feed-post',
        feature: 'social-feed',
        section_id: String(sectionIds[0]),
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
        'Post comment notification failed (delivery unaffected)',
        'PostCommentNotificationService',
        error,
      );
    }
  }

  async notifyCommentReply(params: {
    actorId: number;
    postContentId: number;
    parentOwnerId: number;
    parentCommentId: number;
    sectionIds: number[];
  }): Promise<void> {
    const { actorId, postContentId, parentOwnerId, sectionIds } = params;
    if (actorId === parentOwnerId) return;

    try {
      const [actorName, postTitle] = await Promise.all([
        getActorName(this.dataSource, actorId),
        this.getPostContent(postContentId),
      ]);

      const title = 'มีการตอบกลับความคิดเห็นของคุณ';
      const body = `${actorName} ตอบกลับความคิดเห็นของคุณ`;

      const notificationId = await saveNotification(this.dataSource, {
        actorId,
        type: 'comment-reply',
        feature: 'social-feed',
        notiData: {
          title,
          body,
          actor_name: actorName,
          ref_id: String(postContentId),
          ref_type: 'feed-comment',
          section_id: String(sectionIds[0]),
          post_title: postTitle,
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
        ref_id: String(postContentId),
        ref_type: 'feed-comment',
        feature: 'social-feed',
        section_id: String(sectionIds[0]),
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
        'Post comment reply notification failed (delivery unaffected)',
        'PostCommentNotificationService',
        error,
      );
    }
  }

  private async getPostContent(postContentId: number): Promise<string> {
    const rows = await this.dataSource.query(
      `SELECT content FROM post_content WHERE post_content_id = $1`,
      [postContentId],
    );
    return rows[0]?.content ?? '';
  }
}
