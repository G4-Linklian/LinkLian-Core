import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class BookmarkService {
  constructor(private dataSource: DataSource) {}

  /**
   * Get all bookmarks for a user (similar to old getBookmark with filters)
   */
  async getBookmarks(
    userId?: number,
    postId?: number,
    sectionId?: number,
    flagValid: boolean = true,
    offset: number = 0,
    limit: number = 50,
    sortBy: string = 'saved_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ) {
    // Validate sort_by to prevent SQL injection
    const allowedSortFields = ['saved_at', 'post_id', 'user_sys_id'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'saved_at';
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder) ? sortOrder : 'DESC';

    try {
      const values: any[] = [];
      let paramIndex = 1;

      let query = `
        SELECT b.*, pc.*, pic.section_id, s.section_name, sub.name_th AS subject_name,
          u_creator.first_name || ' ' || u_creator.last_name AS creator_name,
          u_creator.user_sys_id AS creator_id
        FROM bookmark b
        LEFT JOIN post_in_class pic ON b.post_id = pic.post_id
        LEFT JOIN post_content pc ON pic.post_content_id = pc.post_content_id
        LEFT JOIN section s ON pic.section_id = s.section_id AND s.flag_valid = true
        LEFT JOIN subject sub ON s.subject_id = sub.subject_id
        LEFT JOIN user_sys u_creator ON pc.user_sys_id = u_creator.user_sys_id
        WHERE b.flag_valid = $${paramIndex++}
      `;
      values.push(flagValid);

      // Add dynamic filters
      if (userId) {
        query += ` AND b.user_sys_id = $${paramIndex++}`;
        values.push(userId);
      }

      if (postId) {
        query += ` AND b.post_id = $${paramIndex++}`;
        values.push(postId);
      }

      if (sectionId) {
        query += ` AND pic.section_id = $${paramIndex++}`;
        values.push(sectionId);
      }

      // Apply sorting
      query += ` ORDER BY b.${validSortBy} ${validSortOrder}`;

      // Apply pagination
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      values.push(limit, offset);

      const bookmarks = await this.dataSource.query(query, values);

      return {
        success: true,
        totalCount: bookmarks.length,
        message: 'Bookmarks retrieved successfully',
        data: bookmarks,
      };
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      throw new InternalServerErrorException('Failed to fetch bookmarks');
    }
  }

  /**
   * Toggle bookmark (create if not exists, delete if exists) - similar to old createBookmark
   */
  async toggleBookmark(userId: number, postId: number) {
    if (!userId || !postId) {
      throw new BadRequestException('Missing required fields: user_sys_id, post_id');
    }

    try {
      // ✅ ตรวจสอบว่ามี bookmark อยู่แล้วหรือไม่
      const checkQuery = `
        SELECT COUNT(*) as count FROM bookmark 
        WHERE user_sys_id = $1 AND post_id = $2
      `;
      const checkResult = await this.dataSource.query(checkQuery, [userId, postId]);
      const exists = parseInt(checkResult[0]?.count, 10) > 0;

      let action: string;

      if (exists) {
        // ลบ bookmark ที่มีอยู่
        const deleteQuery = `
          DELETE FROM bookmark 
          WHERE user_sys_id = $1 AND post_id = $2
        `;
        await this.dataSource.query(deleteQuery, [userId, postId]);
        action = 'removed';
      } else {
        // สร้าง bookmark ใหม่
        const insertQuery = `
          INSERT INTO bookmark (user_sys_id, post_id, saved_at, flag_valid)
          VALUES ($1, $2, NOW(), true)
        `;
        await this.dataSource.query(insertQuery, [userId, postId]);
        action = 'created';
      }

      return {
        success: true,
        message: action === 'created' 
          ? 'Bookmark created successfully'
          : 'Bookmark removed successfully',
        data: {
          user_sys_id: userId,
          post_id: postId,
          action,
        },
      };
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      throw new InternalServerErrorException('Failed to toggle bookmark');
    }
  }

  /**
   * Delete a bookmark
   */
  async deleteBookmark(userId: number, postId: number) {
    if (!userId || !postId) {
      throw new BadRequestException('Missing required fields: user_sys_id, post_id');
    }

    try {
      const deleteQuery = `
        DELETE FROM bookmark 
        WHERE user_sys_id = $1 AND post_id = $2
        RETURNING *
      `;
      const result = await this.dataSource.query(deleteQuery, [userId, postId]);

      return {
        success: true,
        message: result.length > 0
          ? 'Bookmark deleted successfully'
          : 'Bookmark not found',
        deleted: result.length > 0,
      };
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      throw new InternalServerErrorException('Failed to delete bookmark');
    }
  }
}
