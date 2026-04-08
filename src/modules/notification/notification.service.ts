import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: AppLogger,
  ) {}

  /**
   * ดึง notification list ของ user
   * JOIN notification + notification_receive เพื่อได้ is_read ของ user นั้นๆ
   */
  async getNotifications(
    userId: number,
    { limit, offset }: { limit: number; offset: number },
  ) {
    const rows = await this.dataSource.query(
      `SELECT
         n.notification_id,
         n.type,
         n.feature,
         n.actor_id,
         n.noti_data,
         n.noti_created_at,
         nr.is_read
       FROM notification_receive nr
       JOIN notification n
         ON n.notification_id = nr.notification_id
         AND n.flag_valid = true
       WHERE nr.receiver_id = $1
         AND nr.flag_valid = true
       ORDER BY n.noti_created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const totalRow = await this.dataSource.query(
      `SELECT COUNT(*) AS total
       FROM notification_receive nr
       JOIN notification n ON n.notification_id = nr.notification_id AND n.flag_valid = true
       WHERE nr.receiver_id = $1 AND nr.flag_valid = true`,
      [userId],
    );

    return {
      success: true,
      data: {
        notifications: rows,
        total: Number(totalRow[0].total),
        limit,
        offset,
      },
    };
  }

  /**
   * นับ notification ที่ยังไม่ได้อ่าน
   */
  async getUnreadCount(userId: number) {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*) AS count
       FROM notification_receive nr
       JOIN notification n ON n.notification_id = nr.notification_id AND n.flag_valid = true
       WHERE nr.receiver_id = $1
         AND nr.flag_valid = true
         AND nr.is_read = false`,
      [userId],
    );

    return {
      success: true,
      data: { unread_count: Number(rows[0].count) },
    };
  }

  /**
   * Mark notification อ่านแล้ว — ตรวจสอบว่า user เป็น receiver จริงก่อน
   */
  async markAsRead(userId: number, notificationId: number) {
    const result = await this.dataSource.query(
      `UPDATE notification_receive
       SET is_read = true
       WHERE notification_id = $1
         AND receiver_id = $2
         AND flag_valid = true
       RETURNING notification_id`,
      [notificationId, userId],
    );

    if (!result.length) {
      throw new NotFoundException('Notification not found');
    }

    this.logger.log('Marked as read', 'NotificationService', { notificationId, userId });

    return {
      success: true,
      message: 'Notification marked as read',
    };
  }

  /**
   * Mark ทุก notification ของ user เป็นอ่านแล้ว
   */
  async markAllAsRead(userId: number) {
    const result = await this.dataSource.query(
      `UPDATE notification_receive
       SET is_read = true
       WHERE receiver_id = $1
         AND flag_valid = true
         AND is_read = false`,
      [userId],
    );

    this.logger.log('Marked all as read', 'NotificationService', {
      userId,
      updated: result[1], // rowCount
    });

    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }
}
