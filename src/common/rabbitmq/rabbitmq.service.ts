import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { AppLogger } from 'src/common/logger/app-logger.service';

export type ConsumeHandler = (message: object) => Promise<void>;

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqplib.ChannelModel | null = null;

  // แยก channel สำหรับ publish และ consume
  // amqplib แนะนำให้ไม่ใช้ channel เดียวกันสำหรับทั้งสองงาน
  private publishChannel: amqplib.Channel | null = null;
  private consumeChannel: amqplib.Channel | null = null;

  constructor(private readonly logger: AppLogger) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.close();
  }

  // ─── Connect once on startup ───────────────────────────────────────────────

  private async connect() {
    try {
      const mqUrl =
        process.env.RABBITMQ_URL || 'amqp://user:password@localhost:5672/';

      this.connection = await amqplib.connect(mqUrl);
      this.publishChannel = await this.connection.createChannel();
      this.consumeChannel = await this.connection.createChannel();

      // Fair dispatch — consumer รับทีละ 1 message เพื่อกระจาย load
      await this.consumeChannel.prefetch(1);

      this.connection.on('close', () => {
        this.logger.error(
          'RabbitMQ connection closed, reconnecting...',
          'RabbitMQService',
        );
        this.connection = null;
        this.publishChannel = null;
        this.consumeChannel = null;
        setTimeout(() => this.connect(), 5000);
      });

      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error', 'RabbitMQService', err);
      });

      this.logger.log('RabbitMQ connected', 'RabbitMQService');
    } catch (err) {
      this.logger.error(
        'Failed to connect to RabbitMQ, retrying in 5s...',
        'RabbitMQService',
        err,
      );
      setTimeout(() => this.connect(), 5000);
    }
  }

  // ─── Publish to exchange ───────────────────────────────────────────────────

  async publish(
    exchange: string,
    routingKey: string,
    message: object,
    options: { durable?: boolean; persistent?: boolean } = {},
  ): Promise<void> {
    if (!this.publishChannel) {
      throw new Error('RabbitMQ publish channel is not available');
    }

    await this.publishChannel.assertExchange(exchange, 'topic', {
      durable: options.durable ?? true,
    });

    this.publishChannel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: options.persistent ?? true },
    );
  }

  // ─── Consume from queue ────────────────────────────────────────────────────

  /**
   * Subscribe ไปยัง queue และเรียก handler ทุกครั้งที่มี message เข้า
   *
   * - ack อัตโนมัติเมื่อ handler สำเร็จ
   * - nack (ไม่ requeue) เมื่อ handler throw เพื่อป้องกัน infinite loop
   *
   * @param exchange   - exchange ที่ queue ผูกอยู่
   * @param queue      - ชื่อ queue ที่จะ consume
   * @param routingKey - routing key pattern สำหรับ bind queue กับ exchange
   * @param handler    - async function ที่รับ parsed message object
   */
  async consume(
    exchange: string,
    queue: string,
    routingKey: string,
    handler: ConsumeHandler,
  ): Promise<void> {
    if (!this.consumeChannel) {
      throw new Error('RabbitMQ consume channel is not available');
    }

    await this.consumeChannel.assertExchange(exchange, 'topic', { durable: true });
    await this.consumeChannel.assertQueue(queue, { durable: true });
    await this.consumeChannel.bindQueue(queue, exchange, routingKey);

    await this.consumeChannel.consume(queue, async (msg) => {
      if (!msg) return;

      try {
        const parsed = JSON.parse(msg.content.toString()) as object;
        await handler(parsed);
        this.consumeChannel!.ack(msg);
      } catch (err) {
        this.logger.error(
          `Consumer error on queue "${queue}"`,
          'RabbitMQService',
          err,
        );
        // nack + requeue=false → ไม่วนซ้ำ message ที่ process ไม่ได้
        this.consumeChannel!.nack(msg, false, false);
      }
    });

    this.logger.log(`Consumer registered for queue: ${queue}`, 'RabbitMQService');
  }

  // ─── Graceful shutdown ─────────────────────────────────────────────────────

  private async close() {
    try {
      if (this.consumeChannel) await this.consumeChannel.close();
      if (this.publishChannel) await this.publishChannel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // Ignore close errors on shutdown
    } finally {
      this.publishChannel = null;
      this.consumeChannel = null;
      this.connection = null;
    }
  }
}
