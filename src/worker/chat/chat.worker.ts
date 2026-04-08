import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { JobType } from '../worker.constants';

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
    const { sender_id, receiver_ids, chat_id, message_id, content, created_at, reply_id, file_url } =
      job.data;
    const ctx = 'ChatWorker:message';

    if (receiver_ids.length === 0) return;

    await job.updateProgress(25);

    await Promise.all(
      receiver_ids.map((userId) =>
        this.rabbitmq.publish('linklian_events', 'chat.deliver', {
          type: 'CHAT_DELIVER',
          payload: {
            message_id: String(message_id),
            chat_id: String(chat_id),
            sender_id: String(sender_id),
            receive_user_id: String(userId),
            content,
            created_at,
            reply_id: reply_id ? String(reply_id) : null,
            file_url: file_url ?? null,
          },
        }),
      ),
    );

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { chat_id, message_id, receivers: receiver_ids.length });
  }
}
