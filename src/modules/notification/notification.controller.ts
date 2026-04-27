import { Controller, Get, Patch, Post, Delete, Param, Headers, Query, Body } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Access } from 'src/common/decorators/access.decorator';

@Controller('notification')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  /**
   * GET /notification
   * ดึง notification list ของ user (paginated)
   */
  @Access('notification', 'read')
  @Get()
  getNotifications(
    @Headers('x-user-id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getNotifications(Number(userId), {
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
  }

  /**
   * GET /notification/unread-count
   * นับจำนวน notification ที่ยังไม่ได้อ่าน
   */
  @Access('notification', 'read')
  @Get('unread-count')
  getUnreadCount(
    @Headers('x-user-id') userId: string,
    @Query('feature') feature?: string,
    @Query('exclude_feature') excludeFeature?: string,
  ) {
    return this.service.getUnreadCount(Number(userId), feature, excludeFeature);
  }

  /**
   * PATCH /notification/:id/read
   * mark notification อ่านแล้ว
   */
  @Access('notification', 'update')
  @Patch(':id/read')
  markAsRead(
    @Headers('x-user-id') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.service.markAsRead(Number(userId), Number(notificationId));
  }

  /**
   * PATCH /notification/read-all
   * mark ทั้งหมดเป็นอ่านแล้ว
   */
  @Access('notification', 'update')
  @Patch('read-all')
  markAllAsRead(@Headers('x-user-id') userId: string) {
    return this.service.markAllAsRead(Number(userId));
  }

  /**
   * POST /notification/fcm-token
   * บันทึก FCM token ของ device
   */
  @Access('notification', 'create')
  @Post('fcm-token')
  registerFCMToken(
    @Headers('x-user-id') userId: string,
    @Body() body: { token: string; device_type: string },
  ) {
    return this.service.registerFCMToken(Number(userId), body.token, body.device_type);
  }

  /**
   * DELETE /notification/fcm-token
   * ลบ FCM token เมื่อ logout
   */
  @Access('notification', 'delete')
  @Delete('fcm-token')
  removeFCMToken(
    @Headers('x-user-id') userId: string,
    @Body() body: { token: string },
  ) {
    return this.service.removeFCMToken(Number(userId), body.token);
  }
}
