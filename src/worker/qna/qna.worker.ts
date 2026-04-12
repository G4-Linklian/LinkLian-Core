import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { JobType } from '../worker.constants';
import {
  getActorName,
  saveNotification,
  saveReceivers,
  publishInBatches,
} from '../utils/notification.utils';
import { sendFCMInBatches } from '../utils/fcm.utils';

// ─── Job Payload Types ────────────────────────────────────────────────────────

export type QnaLiveStartedData = {
  type: typeof JobType.QNA_LIVE_STARTED;
  actor_id: number;       // live_by (educator)
  qa_live_id: number;
  section_id: number;
  live_title: string;
};

export type QnaQuestionCreatedData = {
  type: typeof JobType.QNA_QUESTION_CREATED;
  actor_id: number;       // asker_id
  qa_question_id: number;
  qa_live_id: number;
  section_id: number;
  question: string;       // question content
};

export type QnaQuestionUpdatedData = {
  type: typeof JobType.QNA_QUESTION_UPDATED;
  actor_id: number;       // updater (educator)
  qa_question_id: number;
  qa_live_id: number;
  asker_id: number;
  new_status: string;
};

export type QnaJobData =
  | QnaLiveStartedData
  | QnaQuestionCreatedData
  | QnaQuestionUpdatedData;

// ─── Worker ───────────────────────────────────────────────────────────────────

@Injectable()
export class QnaWorker {
  constructor(
    private readonly rabbitmq: RabbitMQService,
    private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  async handle(job: Job<QnaJobData>): Promise<void> {
    await job.updateProgress(0);

    switch (job.data.type) {
      case JobType.QNA_LIVE_STARTED:
        return this.handleLiveStarted(job as Job<QnaLiveStartedData>);
      case JobType.QNA_QUESTION_CREATED:
        return this.handleQuestionCreated(job as Job<QnaQuestionCreatedData>);
      case JobType.QNA_QUESTION_UPDATED:
        return this.handleQuestionUpdated(job as Job<QnaQuestionUpdatedData>);
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private async handleLiveStarted(job: Job<QnaLiveStartedData>): Promise<void> {
    const { actor_id, qa_live_id, section_id, live_title } = job.data;
    const ctx = 'QnaWorker:live-started';

    const [actorName, receiverIds] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getStudentsFromSection(section_id, actor_id),
    ]);

    if (receiverIds.length === 0) {
      this.logger.log('No receivers, skipping', ctx, { qa_live_id });
      return;
    }

    const title = 'QA Live เริ่มต้นแล้ว';
    const body = `${actorName} เปิด QA Live: ${live_title}`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'live-started',
      feature: 'qna',
      notiData: { title, body, actor_name: actorName, ref_id: String(qa_live_id), ref_type: 'qna-live' },
    });

    await saveReceivers(this.dataSource, notificationId, receiverIds);

    await Promise.all([
      publishInBatches(this.rabbitmq, job, receiverIds, (userId) => ({
        type: 'NOTIFICATION',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(userId),
          actor_id: String(actor_id),
          actor_name: actorName,
          title,
          body,
          ref_id: String(qa_live_id),
          ref_type: 'qna-live',
          feature: 'qna',
        },
      })),
      sendFCMInBatches(this.dataSource, receiverIds, {
        title, body,
        actor_id: String(actor_id),
        actor_name: actorName,
        ref_id: String(qa_live_id),
        ref_type: 'qna-live',
        feature: 'qna',
        notification_id: String(notificationId),
      }),
    ]);

    this.logger.log('Completed', ctx, { qa_live_id, total: receiverIds.length });
  }

  private async handleQuestionCreated(job: Job<QnaQuestionCreatedData>): Promise<void> {
    const { actor_id, qa_question_id, qa_live_id, section_id, question } = job.data;
    const ctx = 'QnaWorker:question-created';

    const [actorName, receiverIds] = await Promise.all([
      getActorName(this.dataSource, actor_id),
      this.getAllMembersFromSection(section_id, actor_id),
    ]);

    if (receiverIds.length === 0) {
      this.logger.log('No receivers, skipping', ctx, { qa_question_id });
      return;
    }

    const title = 'มีคำถามใหม่ใน QA Live';
    const body = `${actorName} ถามคำถาม: ${question}`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'question-created',
      feature: 'qna',
      notiData: { title, body, actor_name: actorName, ref_id: String(qa_question_id), ref_type: 'qna-question' },
    });

    await saveReceivers(this.dataSource, notificationId, receiverIds);

    await Promise.all([
      publishInBatches(this.rabbitmq, job, receiverIds, (userId) => ({
        type: 'NOTIFICATION',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(userId),
          actor_id: String(actor_id),
          actor_name: actorName,
          title,
          body,
          ref_id: String(qa_question_id),
          ref_type: 'qna-question',
          feature: 'qna',
        },
      })),
      sendFCMInBatches(this.dataSource, receiverIds, {
        title, body,
        actor_id: String(actor_id),
        actor_name: actorName,
        ref_id: String(qa_question_id),
        ref_type: 'qna-question',
        feature: 'qna',
        notification_id: String(notificationId),
      }),
    ]);

    this.logger.log('Completed', ctx, { qa_question_id, total: receiverIds.length });
  }

  private async handleQuestionUpdated(job: Job<QnaQuestionUpdatedData>): Promise<void> {
    const { actor_id, qa_question_id, qa_live_id, asker_id, new_status } = job.data;
    const ctx = 'QnaWorker:question-updated';

    // ไม่แจ้งตัวเอง
    if (actor_id === asker_id) return;

    const actorName = await getActorName(this.dataSource, actor_id);
    const title = 'คำถามของคุณได้รับการอัปเดต';
    const body = `${actorName} อัปเดตคำถามของคุณเป็น: ${new_status}`;

    const notificationId = await saveNotification(this.dataSource, {
      actorId: actor_id,
      type: 'question-updated',
      feature: 'qna',
      notiData: { title, body, actor_name: actorName, ref_id: String(qa_question_id), ref_type: 'qna-question' },
    });

    await saveReceivers(this.dataSource, notificationId, [asker_id]);
    await job.updateProgress(50);

    await Promise.all([
      this.rabbitmq.publish('linklian_events', 'notification.send', {
        type: 'NOTIFICATION',
        payload: {
          notification_id: String(notificationId),
          receive_user_id: String(asker_id),
          actor_id: String(actor_id),
          actor_name: actorName,
          title,
          body,
          ref_id: String(qa_question_id),
          ref_type: 'qna-question',
          feature: 'qna',
        },
      }),
      sendFCMInBatches(this.dataSource, [asker_id], {
        title, body,
        actor_id: String(actor_id),
        actor_name: actorName,
        ref_id: String(qa_question_id),
        ref_type: 'qna-question',
        feature: 'qna',
        notification_id: String(notificationId),
      }),
    ]);

    await job.updateProgress(100);
    this.logger.log('Completed', ctx, { qa_question_id, asker_id });
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  private async getAllMembersFromSection(
    sectionId: number,
    excludeActorId: number,
  ): Promise<number[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT user_id FROM (
         SELECT e.student_id AS user_id
         FROM enrollment e
         JOIN user_sys u ON e.student_id = u.user_sys_id
           AND u.flag_valid = true AND u.user_status = 'Active'
         WHERE e.section_id = $1 AND e.flag_valid = true AND e.student_id IS NOT NULL

         UNION

         SELECT se.educator_id AS user_id
         FROM section_educator se
         JOIN user_sys u ON se.educator_id = u.user_sys_id
           AND u.flag_valid = true AND u.user_status = 'Active'
         WHERE se.section_id = $1 AND se.flag_valid = true
       ) AS members
       WHERE user_id != $2`,
      [sectionId, excludeActorId],
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }

  private async getStudentsFromSection(
    sectionId: number,
    excludeActorId: number,
  ): Promise<number[]> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT e.student_id AS user_id
       FROM enrollment e
       JOIN user_sys u ON e.student_id = u.user_sys_id
         AND u.flag_valid = true AND u.user_status = 'Active'
       WHERE e.section_id = $1
         AND e.flag_valid = true
         AND e.student_id IS NOT NULL
         AND e.student_id != $2`,
      [sectionId, excludeActorId],
    );
    return rows.map((r: { user_id: number }) => r.user_id);
  }

}
