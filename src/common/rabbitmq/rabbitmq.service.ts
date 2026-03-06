import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqplib from 'amqplib';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

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
      this.channel = await this.connection.createChannel();

      // Auto-reconnect on unexpected close
      this.connection.on('close', () => {
        this.logger.error(
          'RabbitMQ connection closed, reconnecting...',
          'RabbitMQService',
        );
        this.connection = null;
        this.channel = null;
        setTimeout(() => this.connect(), 5000);
      });

      this.connection.on('error', (err) => {
        this.logger.error(
          'RabbitMQ connection error:',
          'RabbitMQService',
          err,
        );
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
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available');
    }

    await this.channel.assertExchange(exchange, 'topic', {
      durable: options.durable ?? true,
    });

    this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: options.persistent ?? true },
    );
  }

  // ─── Graceful shutdown ─────────────────────────────────────────────────────

  private async close() {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // Ignore close errors on shutdown
    } finally {
      this.channel = null;
      this.connection = null;
    }
  }
}
