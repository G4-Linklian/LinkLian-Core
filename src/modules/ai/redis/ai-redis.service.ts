import { Injectable } from '@nestjs/common';
import { RedisService } from 'src/common/redis/redis.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

export interface ChatMessage {
  role: string;
  content: string;
  time: number;
}

@Injectable()
export class AiRedisService {
  private readonly messageTtlSeconds = 3600;
  private readonly maxHistory = 20;

  constructor(
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async getChatHistory(
    chatId: string | number,
    getMessagesFromDB: () => Promise<ChatMessage[]>,
  ): Promise<ChatMessage[]> {
    const key = `chat:${chatId}:messages`;

    const history = await this.redis.lrange(key, 0, -1);

    if (history.length === 0) {
      const dbMessages = await getMessagesFromDB();

      if (dbMessages.length > 0) {
        const payloads = dbMessages.map((message) => JSON.stringify(message));
        await this.redis.rpush(key, ...payloads);
        await this.redis.expire(key, this.messageTtlSeconds);
      }

      return dbMessages;
    }

    return history
      .map((item) => {
        try {
          return JSON.parse(item) as ChatMessage;
        } catch {
          this.logger.warn('Invalid chat message in redis history', 'AiRedisService');
          return null;
        }
      })
      .filter((item): item is ChatMessage => item !== null);
  }

  async addMessage(
    chatId: string | number,
    role: string,
    content: string,
  ): Promise<void> {
    const messagesKey = `chat:${chatId}:messages`;
    const activityKey = `chat:${chatId}:last_activity`;

    const message: ChatMessage = {
      role,
      content,
      time: Date.now(),
    };

    await this.redis.rpush(messagesKey, JSON.stringify(message));
    await this.redis.ltrim(messagesKey, -this.maxHistory, -1);
    await this.redis.expire(messagesKey, this.messageTtlSeconds);

    await this.redis.set(activityKey, Date.now());
    await this.redis.expire(activityKey, this.messageTtlSeconds);
  }

  async setDocsOverview(
    chatId: string | number,
    docsOverview: string,
  ): Promise<void> {
    const docsOverviewKey = `chat:${chatId}:docs_overview`;
    const activityKey = `chat:${chatId}:last_activity`;

    await this.redis.set(docsOverviewKey, docsOverview);
    await this.redis.expire(docsOverviewKey, this.messageTtlSeconds);

    await this.redis.set(activityKey, Date.now());
    await this.redis.expire(activityKey, this.messageTtlSeconds);
  }

  async getDocsOverview(chatId: string | number): Promise<string | null> {
    const docsOverviewKey = `chat:${chatId}:docs_overview`;
    return this.redis.get(docsOverviewKey);
  }

  async clearChatSession(chatId: string | number): Promise<number> {
    const messagesKey = `chat:${chatId}:messages`;
    const chatHistoryKey = `chat:${chatId}:chat_history`;
    const docsOverviewKey = `chat:${chatId}:docs_overview`;
    const activityKey = `chat:${chatId}:last_activity`;

    return this.redis.del(
      messagesKey,
      chatHistoryKey,
      docsOverviewKey,
      activityKey,
    );
  }

  async getLastActivity(chatId: string | number): Promise<number | null> {
    const activityKey = `chat:${chatId}:last_activity`;
    const value = await this.redis.get(activityKey);

    if (!value) {
      return null;
    }

    const timestamp = Number(value);
    return Number.isNaN(timestamp) ? null : timestamp;
  }
}
