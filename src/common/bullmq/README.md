# BullMQ Service

Queue service สำหรับจัดการ background jobs ผ่าน Redis โดยใช้ [BullMQ](https://docs.bullmq.io/)

## Setup

### 1. Install Package

```bash
npm install bullmq
```

### 2. Environment Variables

เพิ่มใน `.env`:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=              # เว้นว่างได้ถ้าไม่มี password
```

### 3. Redis (Dev)

ใช้ Redis จาก `dev/docker-compose.yml` ที่มีอยู่แล้ว:

```bash
cd dev
docker compose up -d
```

---

## Module

`BullMQModule` เป็น `@Global()` — inject `BullMQService` ได้ทุก module โดยไม่ต้อง import เพิ่ม

```typescript
constructor(private readonly bullmq: BullMQService) {}
```

---

## API Reference

### `addJob(queueName, jobName, data, options?)` — เพิ่ม Job (fire-and-forget)

เพิ่ม job เข้า queue แล้วไม่รอผล

```typescript
await this.bullmq.addJob('email-queue', 'send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Hello World',
});
```

**Options:**

| Option              | Type                | Default | Description                      |
|---------------------|---------------------|---------|----------------------------------|
| `delay`             | `number`            | —       | delay ก่อน process (ms)          |
| `attempts`          | `number`            | `3`     | จำนวนครั้งที่ retry              |
| `priority`          | `number`            | —       | ความสำคัญ (1 = สูงสุด)           |
| `removeOnComplete`  | `boolean \| number` | `100`   | ลบ job เมื่อสำเร็จ (หรือเก็บ n ตัวล่าสุด) |
| `removeOnFail`      | `boolean \| number` | `200`   | ลบ job เมื่อ fail                |

---

### `addJobAndWait(queueName, jobName, data, options?)` — เพิ่ม Job แล้วรอผลจาก Worker

เพิ่ม job แล้ว **บล็อกรอจน Worker ทำเสร็จ** — ได้ result กลับมา

```typescript
const result = await this.bullmq.addJobAndWait<
  { userId: string },           // TData — ข้อมูลที่ส่งเข้า
  { pdfUrl: string; gpa: number } // TResult — ผลลัพธ์ที่ได้คืน
>(
  'report-queue',
  'generate-report',
  { userId: '12345' },
  { timeout: 60_000 }, // รอสูงสุด 60 วินาที (default: 30s)
);

console.log(result.pdfUrl); // ค่าที่ worker return กลับมา
console.log(result.gpa);
```

**Options:**

| Option     | Type     | Default  | Description               |
|------------|----------|----------|---------------------------|
| `delay`    | `number` | —        | delay ก่อน process (ms)   |
| `attempts` | `number` | `3`      | จำนวนครั้งที่ retry       |
| `timeout`  | `number` | `30000`  | timeout รอผล (ms)         |

> ถ้า Worker throw error → `addJobAndWait` จะ throw error ตาม สามารถ try/catch ได้ตามปกติ

---

### `registerWorker(queueName, processor, options?)` — สร้าง Worker

Worker คือตัวที่รับ job ไป process — ค่าที่ **return** จะเป็น result ของ `addJobAndWait`

```typescript
@Injectable()
export class ReportWorkerService implements OnModuleInit {
  constructor(private readonly bullmq: BullMQService) {}

  onModuleInit() {
    this.bullmq.registerWorker<
      { userId: string },            // TData
      { pdfUrl: string; gpa: number } // TResult (return type)
    >(
      'report-queue',
      async (job) => {
        const { userId } = job.data;

        // ทำงาน heavy task...
        const pdfUrl = `https://storage.example.com/${userId}.pdf`;

        // ★ return ค่า → ส่งกลับไปหา addJobAndWait
        return { pdfUrl, gpa: 3.75 };
      },
      { concurrency: 2 },
    );
  }
}
```

**Options:**

| Option        | Type     | Default | Description                          |
|---------------|----------|---------|--------------------------------------|
| `concurrency` | `number` | `1`     | จำนวน job ที่ process พร้อมกันได้    |

> อย่าลืม register Worker ที่ module ด้วย เช่น ใส่ใน `providers` ของ module นั้น

---

### `addBulkJobs(queueName, jobs)` — เพิ่มหลาย Job พร้อมกัน

```typescript
await this.bullmq.addBulkJobs('email-queue', [
  { name: 'send-email', data: { to: 'a@test.com', subject: 'Hi' } },
  { name: 'send-email', data: { to: 'b@test.com', subject: 'Hello' } },
]);
```

---

### `addRepeatableJob(queueName, jobName, data, pattern)` — Cron Job

```typescript
// รัน job ทุก 5 นาที
await this.bullmq.addRepeatableJob('cron-queue', 'cleanup', {}, '*/5 * * * *');

// รันทุกวันตี 2
await this.bullmq.addRepeatableJob('cron-queue', 'daily-report', {}, '0 2 * * *');
```

---

### `removeAllRepeatableJobs(queueName)` — ลบ Repeatable Jobs ทั้งหมด

```typescript
await this.bullmq.removeAllRepeatableJobs('cron-queue');
```

---

### `getJobCounts(queueName)` — ดูสถานะ Queue

```typescript
const counts = await this.bullmq.getJobCounts('email-queue');
// { active: 1, completed: 50, delayed: 2, failed: 0, waiting: 5 }
```

---

### `drainQueue(queueName)` — ลบ Job ทั้งหมดจาก Queue

```typescript
await this.bullmq.drainQueue('email-queue');
```

---

### `getQueue(queueName)` — เข้าถึง Queue instance โดยตรง

```typescript
const queue = this.bullmq.getQueue('email-queue');
```

---

### `getQueueEvents(queueName)` — เข้าถึง QueueEvents instance

```typescript
const events = this.bullmq.getQueueEvents('email-queue');
events.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed with`, returnvalue);
});
```

---

## ตัวอย่างเต็ม: ส่ง Email ผ่าน Queue

### Worker (ฝั่ง process)

```typescript
// modules/email/email-worker.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from 'src/common/bullmq/bullmq.service';

interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}

interface EmailJobResult {
  messageId: string;
  sentAt: string;
}

@Injectable()
export class EmailWorkerService implements OnModuleInit {
  constructor(private readonly bullmq: BullMQService) {}

  onModuleInit() {
    this.bullmq.registerWorker<EmailJobData, EmailJobResult>(
      'email-queue',
      async (job) => {
        const { to, subject, body } = job.data;

        // ส่ง email จริง ๆ ตรงนี้...
        const messageId = `msg-${Date.now()}`;

        return {
          messageId,
          sentAt: new Date().toISOString(),
        };
      },
      { concurrency: 3 },
    );
  }
}
```

### Caller (ฝั่งเรียกใช้)

```typescript
// modules/email/email.service.ts
import { Injectable } from '@nestjs/common';
import { BullMQService } from 'src/common/bullmq/bullmq.service';

@Injectable()
export class EmailService {
  constructor(private readonly bullmq: BullMQService) {}

  // แบบ fire-and-forget (ไม่รอผล)
  async sendEmailAsync(to: string, subject: string, body: string) {
    await this.bullmq.addJob('email-queue', 'send-email', {
      to, subject, body,
    });
  }

  // แบบรอผลจาก worker
  async sendEmailAndWait(to: string, subject: string, body: string) {
    const result = await this.bullmq.addJobAndWait<
      { to: string; subject: string; body: string },
      { messageId: string; sentAt: string }
    >(
      'email-queue',
      'send-email',
      { to, subject, body },
      { timeout: 15_000 },
    );

    return result; // { messageId: 'msg-...', sentAt: '2026-...' }
  }
}
```
