import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { JobType, RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE } from '../worker.constants';
import {
  getActorName,
  saveNotification,
  saveReceivers,
} from '../utils/notification.utils';


// ─── Job Payload Types ────────────────────────────────────────────────────────

export type ChatMessageData = {
  type: typeof JobType.CHAT_MESSAGE;
  sender_id: number;
  receiver_ids: number[];
  chat_id: number;
  message_id: number;
  content: string;
  created_at: string;
  reply_id?: number;
  file_url?: string;
};

export type ChatJobData = ChatMessageData;

// ─── Worker ───────────────────────────────────────────────────────────────────

@Injectable()
export class ChatWorker {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: AppLogger,
  ) {}

  async handle(job: Job<ChatJobData>): Promise<void> {
    await job.updateProgress(0);

    switch (job.data.type) {
      case JobType.CHAT_MESSAGE:
        return this.handleMessage(job as Job<ChatMessageData>);
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private async handleMessage(job: Job<ChatMessageData>): Promise<void> {
    const { sender_id, receiver_ids, chat_id, message_id, content, created_at, reply_id } = job.data;
    const ctx = 'ChatWorker:message';

    if (receiver_ids.length === 0) return;

    await job.updateProgress(10);

    // 1. Get sender name
    const actorName = await getActorName(this.dataSource, sender_id);

    await job.updateProgress(25);

    // 2. Save notification to DB
    const notificationId = await saveNotification(this.dataSource, {
      actorId: sender_id,
      type: 'chat-message',
      feature: 'chat',
      notiData: {
        title: actorName,
        body: content,
        actor_name: actorName,
        ref_id: String(chat_id),
        ref_type: 'chat',
      },
    });

    await saveReceivers(this.dataSource, notificationId, receiver_ids);

    await job.updateProgress(50);

    // 3. Foreground — publish chat.deliver → chat_events → Socket → HandleChatDeliver
    //    HandleChatDeliver จัดการทั้ง: real-time message (in room) + socket notification (not in room)
    await Promise.all(
      receiver_ids.map((userId) =>
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, 'chat.deliver', {
          type: 'CHAT_DELIVER',
          payload: {
            message_id: String(message_id),
            chat_id: String(chat_id),
            sender_id: String(sender_id),
            sender_name: actorName,
            receive_user_id: String(userId),
            notification_id: String(notificationId),
            content,
            created_at,
            reply_id: reply_id ? String(reply_id) : null,
          },
        }),
      ),
    );

    await job.updateProgress(75);

    // 4. Background — publish firebase.send → firebase_events → FCMConsumer → Firebase
    await Promise.all(
      receiver_ids.map((userId) =>
        this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE, {
          type: 'FCM_SEND',
          payload: {
            notification_id: String(notificationId),
            receive_user_id: String(userId),
            actor_id: String(sender_id),
            actor_name: actorName,
            title: actorName,
            body: content,
            ref_id: String(chat_id),
            ref_type: 'chat',
            feature: 'chat',
          },
        }),
      ),
    );

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { chat_id, message_id, receivers: receiver_ids.length, notificationId });
  }
}
