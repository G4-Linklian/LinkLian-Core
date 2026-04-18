import { Job } from 'bullmq';
import { DataSource } from 'typeorm';
import { RabbitMQService } from '../../common/rabbitmq/rabbitmq.service';
import {
  PUBLISH_BATCH_SIZE,
  RABBITMQ_EXCHANGE,
} from '../worker.constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NotiData {
  title: string;
  body: string;
  actor_name: string;
  ref_id: string;
  ref_type: string;
  section_id?: string;        // feed-post: section ที่โพสต์สังกัด (สำหรับ navigate ไป ClassDetailPage)
  community_id?: string;      // community-post: community ที่โพสต์สังกัด (สำหรับ navigate ไป CommunityDetailPage)
  post_type?: string;           // ประเภทโพสต์: 'assignment' | 'announcement' | 'question'
  post_title?: string;          // ชื่อโพสต์ที่ถูก comment — แสดงเป็น sub-heading ใน notification card
  days_until_deadline?: number; // จำนวนวันก่อนถึงกำหนดส่ง assignment (สำหรับ post_type = 'assignment')
  qa_live_id?: string;          // QnA Live ID สำหรับ navigate ไปยัง live session ที่ถูกต้อง
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

// ─── Section Member Queries ───────────────────────────────────────────────────

/**
 * ดึง user ทั้งหมด (นักเรียน + ครู) จาก sections ที่กำหนด ยกเว้น actor
 *
 * ใช้ร่วมกันระหว่าง SocialFeedWorker (multi-section) และ QnaWorker (single section)
 * ผู้เรียกที่มี section เดียวให้ส่ง [sectionId] แทน
 */
export async function getMembersFromSections(
  dataSource: DataSource,
  sectionIds: number[],
  excludeActorId: number,
): Promise<number[]> {
  if (sectionIds.length === 0) return [];

  const placeholders = sectionIds.map((_, i) => `$${i + 2}`).join(', ');
  const rows = await dataSource.query(
    `SELECT DISTINCT user_id FROM (
       SELECT e.student_id AS user_id
       FROM enrollment e
       JOIN user_sys u ON e.student_id = u.user_sys_id
         AND u.flag_valid = true AND u.user_status = 'Active'
       WHERE e.section_id IN (${placeholders})
         AND e.flag_valid = true AND e.student_id IS NOT NULL

       UNION

       SELECT se.educator_id AS user_id
       FROM section_educator se
       JOIN user_sys u ON se.educator_id = u.user_sys_id
         AND u.flag_valid = true AND u.user_status = 'Active'
       WHERE se.section_id IN (${placeholders})
         AND se.flag_valid = true
     ) AS members
     WHERE user_id != $1`,
    [excludeActorId, ...sectionIds],
  );
  return rows.map((r: { user_id: number }) => r.user_id);
}

// ─── Post Type Translation ────────────────────────────────────────────────────

const POST_TYPE_TH: Record<string, string> = {
  announcement: 'ประกาศ',
  assignment:   'การบ้าน',
  question:     'คำถาม',
  post:         'โพสต์', //สำหรับ Commu อย่างเดียว
};

/**
 * แปล post_type จากภาษาอังกฤษเป็นภาษาไทย
 * ถ้าไม่พบใน map จะคืนค่าเดิม
 */
export function translatePostType(postType: string): string {
  return POST_TYPE_TH[postType] ?? postType;
}

// ─── RabbitMQ Utils ───────────────────────────────────────────────────────────

/**
 * Publish notification ไปยัง RabbitMQ แบบ Sequential chunks + Parallel within chunk
 *
 * แนวคิด:
 *   - แบ่ง receiverIds เป็น chunk ละ PUBLISH_BATCH_SIZE
 *   - ส่ง chunk ทีละชุด (sequential) → memory ไม่พุ่ง ไม่ crash
 *   - ภายในแต่ละ chunk ส่งพร้อมกันหมด (parallel) → เร็ว
 *
 * @param rabbitmq     - RabbitMQ service สำหรับ publish
 * @param job          - BullMQ job สำหรับ updateProgress
 * @param receiverIds  - list ของ user_id ที่จะรับ notification
 * @param buildPayload - ฟังก์ชันที่รับ userId แล้วคืน message object
 * @param routingKey   - routing key ปลายทาง เช่น 'notification.send' หรือ 'firebase.send'
 */
export async function publishInBatches(
  rabbitmq: RabbitMQService,
  job: Job,
  receiverIds: number[],
  buildPayload: (userId: number) => object,
  routingKey: string,
): Promise<void> {
  const total = receiverIds.length;

  for (let i = 0; i < total; i += PUBLISH_BATCH_SIZE) {
    const chunk = receiverIds.slice(i, i + PUBLISH_BATCH_SIZE);

    await Promise.all(
      chunk.map((userId) =>
        rabbitmq.publish(RABBITMQ_EXCHANGE, routingKey, buildPayload(userId)),
      ),
    );

    await job.updateProgress(Math.round(((i + chunk.length) / total) * 100));
  }
}
