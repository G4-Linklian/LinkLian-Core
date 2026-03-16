import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor(private readonly logger: AppLogger) {
    const options: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    };

    this.client = new Redis(options);

    this.client.on('connect', () => {
      this.logger.log('Redis connected', 'RedisService');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', 'RedisService', error);
    });
  }

  async onModuleInit() {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (values.length === 0) {
      return this.client.llen(key);
    }

    return this.client.rpush(key, ...values);
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    return this.client.ltrim(key, start, stop);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async set(key: string, value: string | number): Promise<'OK'> {
    return this.client.set(key, String(value));
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    return this.client.del(...keys);
  }
}
