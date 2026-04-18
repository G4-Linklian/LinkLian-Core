import * as admin from 'firebase-admin';
import { DataSource } from 'typeorm';
import { PUBLISH_BATCH_SIZE } from '../worker.constants';

// ─── Firebase Init ────────────────────────────────────────────────────────────

let initialized = false;

function validateFirebaseEnv(): void {
  const missing = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    throw new Error(
      `Firebase Admin SDK: missing required environment variables: ${missing.join(', ')}. ` +
        'FCM notifications will not work until these are set.',
    );
  }
}

function getFirebaseApp(): admin.app.App {
  if (!initialized) {
    validateFirebaseEnv();
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    initialized = true;
  }
  return admin.app();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FCMPayload {
  title: string;
  body: string;
  actor_id: string;
  actor_name: string;
  ref_id: string;
  ref_type: string;
  feature: string;
  notification_id: string;
  receive_user_id: string;      // ใช้ระบุ device ที่รับ + ส่งกลับไปใน data block ให้ Flutter
  section_id?: string;
  community_id?: string;
  post_type?: string;           // social-feed: 'assignment' | 'announcement' | 'question'
  post_title?: string;          // ชื่อโพสต์ที่ถูก comment
  days_until_deadline?: number; // จำนวนวันก่อนถึงกำหนดส่ง assignment
  qa_live_id?: string;          // QnA Live ID สำหรับ navigate
}

// ─── Utils ────────────────────────────────────────────────────────────────────

/**
 * ดึง FCM tokens ของ receivers จาก DB
 * return เฉพาะ token ที่ flag_valid = true
 */
export async function getFCMTokens(
  dataSource: DataSource,
  receiverIds: number[],
): Promise<{ receiver_id: number; token: string }[]> {
  if (receiverIds.length === 0) return [];

  const rows = await dataSource.query(
    `SELECT receiver_id, token
     FROM notification_fcm
     WHERE receiver_id = ANY($1::bigint[])
       AND flag_valid = true`,
    [receiverIds],
  );
  return rows;
}

/**
 * ส่ง FCM notification ไปยัง receivers แบบ batch
 *
 * - ดึง tokens จาก DB ก่อน
 * - ส่ง Firebase sendEachForMulticast ทีละ batch (Firebase limit = 500 tokens ต่อ call)
 * - token ที่ invalid จะถูก mark flag_valid = false อัตโนมัติ
 */
export async function sendFCMInBatches(
  dataSource: DataSource,
  receiverIds: number[],
  payload: FCMPayload,
): Promise<void> {
  const tokenRows = await getFCMTokens(dataSource, receiverIds);
  if (tokenRows.length === 0) return;

  const app = getFirebaseApp();
  const messaging = app.messaging();

  // แบ่ง batch ละ PUBLISH_BATCH_SIZE (500) เพราะ Firebase limit = 500 tokens ต่อ call
  for (let i = 0; i < tokenRows.length; i += PUBLISH_BATCH_SIZE) {
    const batch = tokenRows.slice(i, i + PUBLISH_BATCH_SIZE);
    const tokens = batch.map((r) => r.token);

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        notification_id: payload.notification_id,
        receive_user_id: payload.receive_user_id,
        actor_id: payload.actor_id,
        actor_name: payload.actor_name,
        title: payload.title,
        body: payload.body,
        ref_id: payload.ref_id,
        ref_type: payload.ref_type,
        feature: payload.feature,
        ...(payload.section_id && { section_id: payload.section_id }),
        ...(payload.community_id && { community_id: payload.community_id }),
        ...(payload.post_type && { post_type: payload.post_type }),
        ...(payload.post_title && { post_title: payload.post_title }),
        ...(payload.days_until_deadline != null && { days_until_deadline: String(payload.days_until_deadline) }),
        ...(payload.qa_live_id && { qa_live_id: payload.qa_live_id }),
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const response = await messaging.sendEachForMulticast(message);

    // mark token ที่ invalid ออกจาก DB
    const invalidTokens = response.responses
      .map((r, idx) => (!r.success ? batch[idx].token : null))
      .filter(Boolean) as string[];

    if (invalidTokens.length > 0) {
      await dataSource.query(
        `UPDATE notification_fcm
         SET flag_valid = false
         WHERE token = ANY($1::text[])`,
        [invalidTokens],
      );
    }
  }
}
