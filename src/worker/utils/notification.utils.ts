import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import {
  PUBLISH_BATCH_SIZE,
  RABBITMQ_EXCHANGE,
  RABBITMQ_ROUTING_KEY,
} from '../worker.constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotiData {
  title: string;
  body: string;
  actor_name: string;
  ref_id: string;
  ref_type: string;
  section_id?: string;    // feed-post: section ที่โพสต์สังกัด (สำหรับ navigate ไป ClassDetailPage)
  community_id?: string;  // community-post: community ที่โพสต์สังกัด (สำหรับ navigate ไป CommunityDetailPage)
}

// ─── DB Utils ─────────────────────────────────────────────────────────────────

/**
 * ดึงชื่อผู้ใช้จาก user_sys
 */
export async function getActorName(
  dataSource: DataSource,
  actorId: number,
): Promise<string> {
  const rows = await dataSource.query(
    `SELECT TRIM(CONCAT_WS(' ', first_name, last_name)) AS display_name
     FROM user_sys
     WHERE user_sys_id = $1 AND flag_valid = true
     LIMIT 1`,
    [actorId],
  );
  return rows[0]?.display_name ?? 'Unknown';
}

/**
 * บันทึก notification ลง DB → คืน notification_id
 *
 * @param actorId   - ผู้ที่ trigger notification
 * @param type      - ประเภท event เช่น 'post-created', 'comment'
 * @param feature   - domain เช่น 'social-feed', 'community'
 * @param notiData  - JSON ที่ Mobile ใช้แสดงผลและ navigate
 */
export async function saveNotification(
  dataSource: DataSource,
  params: {
    actorId: number;
    type: string;
    feature: string;
    notiData: NotiData;
  },
): Promise<number> {
  const rows = await dataSource.query(
    `INSERT INTO notification (actor_id, type, feature, noti_data, noti_created_at, flag_valid)
     VALUES ($1, $2, $3, $4, now(), true)
     RETURNING notification_id`,
    [params.actorId, params.type, params.feature, JSON.stringify(params.notiData)],
  );
  return rows[0].notification_id;
}

/**
 * บันทึก receivers ลง notification_receive (batch insert ด้วย unnest)
 *
 * ใช้ PostgreSQL unnest() เพื่อ INSERT ทีเดียวทุกคน แทนที่จะ loop
 * ไม่ว่าจะมี 10 คน หรือ 10,000 คน ก็ทำใน 1 query
 */
export async function saveReceivers(
  dataSource: DataSource,
  notificationId: number,
  receiverIds: number[],
): Promise<void> {
  if (receiverIds.length === 0) return;

  await dataSource.query(
    `INSERT INTO notification_receive (notification_id, receiver_id, is_read, flag_valid)
     SELECT $1, unnest($2::bigint[]), false, true`,
    [notificationId, receiverIds],
  );
}

// ─── RabbitMQ Utils ───────────────────────────────────────────────────────────

/**
 * ส่ง notification ไปยัง RabbitMQ แบบ Sequential chunks + Parallel within chunk
 *
 * แนวคิด:
 *   - แบ่ง receiverIds เป็น chunk ละ PUBLISH_BATCH_SIZE
 *   - ส่ง chunk ทีละชุด (sequential) → memory ไม่พุ่ง ไม่ crash
 *   - ภายในแต่ละ chunk ส่งพร้อมกันหมด (parallel) → เร็ว
 *
 * @param rabbitmq     - RabbitMQ service สำหรับ publish
 * @param job          - BullMQ job สำหรับ updateProgress
 * @param receiverIds  - list ของ user_id ที่จะรับ notification
 * @param buildPayload - ฟังก์ชันที่รับ userId แล้วคืน payload (มี notification_id อยู่แล้ว)
 */
export async function publishInBatches(
  rabbitmq: RabbitMQService,
  job: Job,
  receiverIds: number[],
  buildPayload: (userId: number) => object,
): Promise<void> {
  const total = receiverIds.length;

  for (let i = 0; i < total; i += PUBLISH_BATCH_SIZE) {
    const chunk = receiverIds.slice(i, i + PUBLISH_BATCH_SIZE);

    await Promise.all(
      chunk.map((userId) =>
        rabbitmq.publish(RABBITMQ_EXCHANGE, RABBITMQ_ROUTING_KEY, buildPayload(userId)),
      ),
    );

    await job.updateProgress(Math.round(((i + chunk.length) / total) * 100));
  }
}
