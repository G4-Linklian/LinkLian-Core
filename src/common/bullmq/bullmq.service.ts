import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BullMQService implements OnModuleInit, OnModuleDestroy {
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private queueEvents = new Map<string, QueueEvents>();
  private connection: ConnectionOptions;

  constructor(private readonly logger: AppLogger) {
    this.connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }

  async onModuleInit() {
    this.logger.log('BullMQ service initialized', 'BullMQService');
  }

  async onModuleDestroy() {
    await this.closeAll();
  }

  // ─── Queue Management ───────────────────────────────────────────────────────

  /**
   * สร้างหรือดึง Queue ที่มีอยู่แล้ว
   */
  getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, { connection: this.connection });
      this.queues.set(queueName, queue);
      this.logger.log(`Queue "${queueName}" created`, 'BullMQService');
    }
    return this.queues.get(queueName)!;
  }

  // ─── Add Job ────────────────────────────────────────────────────────────────

  /**
   * เพิ่ม Job เข้า Queue
   */
  async addJob<T extends object = object>(input: {
    queue: string;
    job: string;
    data: T;
    delay?: number;
    attempts?: number;
    // Optional advanced settings (kept for backward compatibility)
    priority?: number;
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
  }): Promise<Job<T>> {
    const queue = this.getQueue(input.queue);
    const jobId = `${input.job}_${uuidv4()}`;
    const job = await queue.add(input.job, input.data, {
      jobId,
      delay: input.delay,
      attempts: input.attempts ?? 3,
      priority: input.priority,
      removeOnComplete: input.removeOnComplete ?? 100,
      removeOnFail: input.removeOnFail ?? 200,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.logger.log(
      `Job added to queue`,
      'BullMQService',
      {
        job: input.job,
        queue: input.queue,
        jobId: job.id,
      },
    );
    return job;
  }

  // ─── Add Job & Wait for Result ──────────────────────────────────────────────

  /**
   * เพิ่ม Job เข้า Queue แล้วรอ Worker ทำงานเสร็จ → ได้ result กลับมา
   */
  async addJobAndWait<TResult = unknown>(input: {
    queue: string;
    job: string;
    data: object;
    timeout?: number; // ms — timeout รอผล (default: 30s)
    delay?: number;
    attempts?: number;
  }): Promise<TResult> {
    const queue = this.getQueue(input.queue);
    const queueEvents = this.getQueueEvents(input.queue);
    const jobId = `${input.job}_${uuidv4()}`;

    const job = await queue.add(input.job, input.data, {
      jobId,
      delay: input.delay,
      attempts: input.attempts ?? 3,
      removeOnComplete: 100,
      removeOnFail: 200,
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.log(
      `Job added to queue, waiting for result...`,
      'BullMQService',
      {
        job: input.job,
        queue: input.queue,
        jobId : job.id,
      }
    );

    const timeout = input.timeout ?? 30_000;
    const result = await job.waitUntilFinished(queueEvents, timeout);

    this.logger.log(
      `Job finished in queue`,
      'BullMQService',
      {
        job: input.job,
        queue: input.queue,
        jobId: job.id,
      }
    );

    return result;
  }

  // ─── Add Bulk Jobs ──────────────────────────────────────────────────────────

  /**
   * เพิ่มหลาย Job พร้อมกัน
   */
  async addBulkJobs<T extends object>(
    queueName: string,
    jobs: { name: string; data: T }[],
  ): Promise<Job<T>[]> {
    const queue = this.getQueue(queueName);
    const result = await queue.addBulk(
      jobs.map((j) => ({
        name: j.name,
        data: j.data,
        opts: {
          attempts: 3,
          removeOnComplete: 100,
          removeOnFail: 200,
          backoff: { type: 'exponential' as const, delay: 2000 },
        },
      })),
    );

    this.logger.log(
      `${result.length} jobs added to queue "${queueName}"`,
      'BullMQService',
    );
    return result;
  }

  // ─── Register Worker ────────────────────────────────────────────────────────

  /**
   * สร้าง Worker สำหรับ process Job จาก Queue
   */
  registerWorker<T extends object, R = void>(
    queueName: string,
    processor: (job: Job<T>) => Promise<R>,
    options?: {
      concurrency?: number;
    },
  ): Worker<T> {
    if (this.workers.has(queueName)) {
      this.logger.warn(
        `Worker for queue "${queueName}" already registered`,
        'BullMQService',
      );
      return this.workers.get(queueName)! as Worker<T>;
    }

    const worker = new Worker<T>(queueName, processor, {
      connection: this.connection,
      concurrency: options?.concurrency ?? 1,
    });

    worker.on('completed', (job: Job<T>) => {
      this.logger.log(
        `Job "${job.name}" (id: ${job.id}) completed in queue "${queueName}"`,
        'BullMQService',
      );
    });

    worker.on('failed', (job: Job<T> | undefined, err: Error) => {
      this.logger.error(
        `Job "${job?.name}" (id: ${job?.id}) failed in queue "${queueName}": ${err.message}`,
        'BullMQService',
      );
    });

    this.workers.set(queueName, worker as Worker);
    this.logger.log(
      `Worker registered for queue "${queueName}"`,
      'BullMQService',
    );
    return worker;
  }

  // ─── Queue Events ──────────────────────────────────────────────────────────

  /**
   * สร้าง QueueEvents สำหรับ listen events ของ Queue
   */
  getQueueEvents(queueName: string): QueueEvents {
    if (!this.queueEvents.has(queueName)) {
      const events = new QueueEvents(queueName, {
        connection: this.connection,
      });
      this.queueEvents.set(queueName, events);
    }
    return this.queueEvents.get(queueName)!;
  }

  // ─── Scheduled / Repeatable Jobs ────────────────────────────────────────────

  /**
   * เพิ่ม Repeatable Job (cron-based)
   */
  async addRepeatableJob<T extends object>(
    queueName: string,
    jobName: string,
    data: T,
    pattern: string, // cron pattern เช่น '*/5 * * * *'
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, data, {
      repeat: { pattern },
      removeOnComplete: 50,
      removeOnFail: 100,
    });

    this.logger.log(
      `Repeatable job "${jobName}" added to queue "${queueName}" with pattern "${pattern}"`,
      'BullMQService',
    );
    return job;
  }

  /**
   * ลบ Repeatable Jobs ทั้งหมดจาก Queue
   */
  async removeAllRepeatableJobs(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const repeatableJobs = await queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key);
    }
    this.logger.log(
      `All repeatable jobs removed from queue "${queueName}"`,
      'BullMQService',
    );
  }

  // ─── Utilities ──────────────────────────────────────────────────────────────

  /**
   * ดูสถานะ Job counts ของ Queue
   */
  async getJobCounts(
    queueName: string,
  ): Promise<Record<string, number>> {
    const queue = this.getQueue(queueName);
    return queue.getJobCounts(
      'active',
      'completed',
      'delayed',
      'failed',
      'waiting',
    );
  }

  /**
   * ลบ Job ทั้งหมดจาก Queue
   */
  async drainQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.drain();
    this.logger.log(`Queue "${queueName}" drained`, 'BullMQService');
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  private async closeAll() {
    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.log(`Worker "${name}" closed`, 'BullMQService');
    }
    for (const [name, events] of this.queueEvents) {
      await events.close();
      this.logger.log(`QueueEvents "${name}" closed`, 'BullMQService');
    }
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.log(`Queue "${name}" closed`, 'BullMQService');
    }
    this.workers.clear();
    this.queueEvents.clear();
    this.queues.clear();
    this.logger.log('All BullMQ resources closed', 'BullMQService');
  }
}
