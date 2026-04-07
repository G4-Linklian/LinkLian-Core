import { Injectable } from '@nestjs/common';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RedisService } from 'src/common/redis/redis.service';
import { QALiveLog } from '../qa_live/entities/qa_live_log.entity';
import { QAQuestion } from '../qa_question/entities/qa_question.entity';

@Injectable()
export class QnaRedisService {
  private readonly ttlSeconds = 6 * 60 * 60;

  constructor(
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) { }

  private activeSlideKey(qaLiveId: number): string {
    return `qa_live:${qaLiveId}:active_slide`;
  }

  private questionKey(qaQuestionId: number): string {
    return `qa_question:${qaQuestionId}`;
  }

  private questionListKey(qaLiveId: number): string {
    return `qa_live:${qaLiveId}:questions`;
  }

  async setActiveSlide(qaLiveId: number, log: QALiveLog): Promise<void> {
    const key = this.activeSlideKey(qaLiveId);
    await this.redis.set(key, JSON.stringify(log));
    await this.redis.expire(key, this.ttlSeconds);
  }

  async getActiveSlide(qaLiveId: number): Promise<QALiveLog | null> {
    const key = this.activeSlideKey(qaLiveId);
    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as QALiveLog;
    } catch (error) {
      this.logger.error('Invalid QA active slide payload in redis', 'QnaRedisService', error);
      await this.redis.del(key);
      return null;
    }
  }

  async clearActiveSlide(qaLiveId: number): Promise<void> {
    await this.redis.del(this.activeSlideKey(qaLiveId));
  }

  async cacheQuestion(question: QAQuestion): Promise<void> {
    const detailKey = this.questionKey(question.qa_question_id);
    await this.redis.set(detailKey, JSON.stringify(question));
    await this.redis.expire(detailKey, this.ttlSeconds);

    await this.upsertQuestionInList(question);
  }

  async cacheQuestionList(qaLiveId: number, questions: QAQuestion[]): Promise<void> {
    const key = this.questionListKey(qaLiveId);
    await this.redis.set(key, JSON.stringify(questions));
    await this.redis.expire(key, this.ttlSeconds);

    for (const question of questions) {
      const detailKey = this.questionKey(question.qa_question_id);
      await this.redis.set(detailKey, JSON.stringify(question));
      await this.redis.expire(detailKey, this.ttlSeconds);
    }
  }

  async getQuestion(qaQuestionId: number): Promise<QAQuestion | null> {
    const key = this.questionKey(qaQuestionId);
    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as QAQuestion;
    } catch (error) {
      this.logger.error('Invalid QA question payload in redis', 'QnaRedisService', error);
      await this.redis.del(key);
      return null;
    }
  }

  async getQuestionList(qaLiveId: number): Promise<QAQuestion[] | null> {
    const key = this.questionListKey(qaLiveId);
    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    try {
      const questions = JSON.parse(value) as QAQuestion[];
      return Array.isArray(questions) ? questions : null;
    } catch (error) {
      this.logger.error('Invalid QA question list payload in redis', 'QnaRedisService', error);
      await this.redis.del(key);
      return null;
    }
  }

  async updateQuestionStatus(qaQuestionId: number, status: string): Promise<void> {
    const question = await this.getQuestion(qaQuestionId);

    if (!question) {
      return;
    }

    question.status = status;
    await this.cacheQuestion(question);
  }

  async updateQuestionUpvote(qaQuestionId: number, upvoteCount: number): Promise<void> {
    const question = await this.getQuestion(qaQuestionId);

    if (!question) {
      return;
    }

    question.upvote_count = upvoteCount;
    await this.cacheQuestion(question);
  }

  async invalidateQuestionList(qaLiveId: number): Promise<void> {
    await this.redis.del(this.questionListKey(qaLiveId));
  }

  private async upsertQuestionInList(question: QAQuestion): Promise<void> {
    const list = await this.getQuestionList(question.qa_live_id);

    if (!list) {
      return;
    }

    const index = list.findIndex(
      (item) => item.qa_question_id === question.qa_question_id,
    );

    if (index >= 0) {
      list[index] = {
        ...list[index],
        ...question,
      };
    } else {
      list.push(question);
    }

    await this.cacheQuestionList(question.qa_live_id, list);
  }
}
