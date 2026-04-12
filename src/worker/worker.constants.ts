// ─── Queue ───────────────────────────────────────────────────────────────────

export const NOTIFICATION_QUEUE = 'notification_queue';
export const WORKER_CONCURRENCY = 50;  // I/O-bound → ตั้งสูงได้ปลอดภัย
export const PUBLISH_BATCH_SIZE = 500;

// ─── RabbitMQ ────────────────────────────────────────────────────────────────

export const RABBITMQ_EXCHANGE = 'linklian_events';
export const RABBITMQ_ROUTING_KEY = 'notification.send';

// ─── Job Types ────────────────────────────────────────────────────────────────
// format: '<domain>:<event>'

export const JobType = {
  // Social Feed
  SOCIAL_FEED_POST_CREATED: 'social-feed.post-created',
  SOCIAL_FEED_POST_UPDATED: 'social-feed.post-updated',
  SOCIAL_FEED_COMMENT:      'social-feed.comment',

  // Community
  COMMUNITY_POST_CREATED:   'community.post-created',
  COMMUNITY_POST_UPDATED:   'community.post-updated',
  COMMUNITY_COMMENT:        'community.comment',
  COMMUNITY_MEMBER_JOINED:  'community.member-joined',
  COMMUNITY_MEMBER_APPROVED:'community.member-approved',

  // QnA
  QNA_LIVE_STARTED: 'qna.live-started',
  QNA_QUESTION_CREATED: 'qna.question-created',
  QNA_QUESTION_UPDATED: 'qna.question-updated',

  // Chat
  CHAT_MESSAGE: 'chat.message',
} as const;

export type JobTypeName = (typeof JobType)[keyof typeof JobType];
