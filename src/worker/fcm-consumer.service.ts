import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { AppLogger } from '../common/logger/app-logger.service';
import { FCMPayload, sendFCMInBatches } from './utils/fcm.utils';
import {
  RABBITMQ_EXCHANGE,
  RABBITMQ_ROUTING_KEY_FIREBASE,
} from './worker.constants';

// ─── Message format ───────────────────────────────────────────────────────────

const FIREBASE_QUEUE = 'firebase_events';

interface FCMMessage {
  type: 'FCM_SEND';
  payload: FCMPayload;
}

// ─── Consumer ─────────────────────────────────────────────────────────────────

/**
 * FCMConsumerService
 *
 * Consume messages จาก `firebase_events` queue แล้วส่ง push notification
 * ผ่าน Firebase Admin SDK
 *
 * Flow:
 *   Worker → RabbitMQ (firebase.send) → firebase_events queue
 *         → FCMConsumerService → Firebase Admin SDK → FCM → Flutter
 */
@Injectable()
export class FCMConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit() {
    await this.rabbitmq.consume(
      RABBITMQ_EXCHANGE,
      FIREBASE_QUEUE,
      RABBITMQ_ROUTING_KEY_FIREBASE,
      (msg) => this.handleFCMSend(msg as FCMMessage),
    );

    this.logger.log('FCMConsumer started', 'FCMConsumerService', {
      queue: FIREBASE_QUEUE,
      routingKey: RABBITMQ_ROUTING_KEY_FIREBASE,
    });
  }

  // ─── Handler ───────────────────────────────────────────────────────────────

  private async handleFCMSend(msg: FCMMessage): Promise<void> {
    if (msg.type !== 'FCM_SEND') {
      this.logger.warn(
        `Unknown message type: ${(msg as any).type}, skipping`,
        'FCMConsumerService',
      );
      return;
    }

    const receiverId = parseInt(msg.payload.receive_user_id, 10);

    if (isNaN(receiverId)) {
      this.logger.error(
        `Invalid receive_user_id: ${msg.payload.receive_user_id}`,
        'FCMConsumerService',
      );
      return;
    }

    await sendFCMInBatches(this.dataSource, [receiverId], msg.payload);
  }
}
