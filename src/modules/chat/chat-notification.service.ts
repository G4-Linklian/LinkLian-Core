import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE } from 'src/worker/worker.constants';
import {
  getActorName,
  saveNotification,
  saveReceivers,
} from 'src/worker/utils/notification.utils';
import { Message } from './entities/message.entity';

@Injectable()
export class ChatNotificationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rabbitmq: RabbitMQService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * ดึงชื่อ sender และ receiver_id สำหรับ chat 1-1
   */
  async getChatDeliveryInfo(
    chatId: number,
    senderId: number,
  ): Promise<{ receiverId: number; senderName: string }> {
    const [receiverRows, senderName] = await Promise.all([
      this.dataSource.query(
        `SELECT user_sys_id FROM user_sys_chat_normalize
         WHERE chat_id = $1 AND user_sys_id <> $2
         LIMIT 1`,
        [chatId, senderId],
      ),
      getActorName(this.dataSource, senderId),
    ]);

    return {
      receiverId: receiverRows?.[0]?.user_sys_id ?? 0,
      senderName,
    };
  }

  /**
   * บันทึก notification ลง DB และส่ง Firebase push
   * แยกออกจาก delivery flow — ถ้า fail จะ log เฉยๆ ไม่กระทบการส่งข้อความ
   */
  async notify(message: Message, receiverId: number, senderName: string): Promise<number> {
    try {
      const notificationId = await saveNotification(this.dataSource, {
        actorId: message.sender_id,
        type: 'chat-message',
        feature: 'chat',
        notiData: {
          title: senderName,
          body: message.content,
          actor_name: senderName,
          ref_id: String(message.chat_id),
          ref_type: 'chat',
        },
      });

      await saveReceivers(this.dataSource, notificationId, [receiverId]);

      await this.rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY_FIREBASE, {
        type: 'FCM_SEND',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(receiverId),
          actor_id: String(message.sender_id),
          actor_name: senderName,
          title: senderName,
          body: message.content,
          ref_id: String(message.chat_id),
          ref_type: 'chat',
          feature: 'chat',
        },
      });

      return notificationId;
    } catch (error) {
      this.logger.error('Chat notification failed (delivery unaffected)', 'ChatNotificationService', error);
      return 0;
    }
  }
}
