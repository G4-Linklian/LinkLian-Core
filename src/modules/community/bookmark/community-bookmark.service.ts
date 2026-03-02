import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';

import { DataSource } from 'typeorm';

@Injectable()
export class CommunityBookmarkService {
  constructor(private dataSource: DataSource) {}

  async toggleBookmark(userId: number, postCommuId: number) {
    if (!postCommuId) throw new BadRequestException('post_commu_id required');
    try {
      const post = await this.dataSource.query(
        `
       SELECT p.post_commu_id,
         p.community_id,
         c.status,
         c.is_private
        FROM post_in_community p
        JOIN community c
          ON c.community_id = p.community_id
        WHERE p.post_commu_id=$1
          AND p.flag_valid=true
      `,
        [postCommuId],
      );

      if (!post.length) throw new BadRequestException('Post not found');

      if (post[0].status !== 'active')
        throw new ForbiddenException('Community is inactive');
      if (post[0].is_private) {
        const member = await this.dataSource.query(
          `
    SELECT 1
    FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
      AND status='active'
      AND flag_valid=true
    `,
          [post[0].community_id, userId],
        );

        if (!member.length) {
          throw new ForbiddenException('Private community');
        }
      }

      const exists = await this.dataSource.query(
        `
      SELECT 1
      FROM community_bookmark
      WHERE user_sys_id=$1
        AND post_commu_id=$2
      `,
        [userId, postCommuId],
      );

      if (!exists.length) {
        // INSERT
        await this.dataSource.query(
          `
        INSERT INTO community_bookmark
        (user_sys_id, post_commu_id, saved_at, flag_valid)
        VALUES ($1,$2,NOW(), true)
        `,
          [userId, postCommuId],
        );
        const bookmarkData = {
          action: 'created',
          post_commu_id: postCommuId,
        };

        return {
          success: true,
          data: bookmarkData,
          message: 'Bookmark created successfully!',
        };
      }

      // DELETE
      await this.dataSource.query(
        `
        DELETE FROM community_bookmark
        WHERE user_sys_id=$1
          AND post_commu_id=$2
        `,
        [userId, postCommuId],
      );
      const bookmarkData = {
        action: 'removed',
        post_commu_id: postCommuId,
      };

      return {
        success: true,
        data: bookmarkData,
        message: 'Bookmark removed successfully!',
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      console.error('Error toggling bookmark:', error);
      throw new InternalServerErrorException('Error processing bookmark');
    }
  }
  // GET MY BOOKMARK POSTS
  async getMyBookmarks(userId: number) {
    try {
      const result = await this.dataSource.query(
        `
      SELECT
        p.post_commu_id,
        p.content,
        p.created_at,
        u.first_name,
        u.last_name,
        u.profile_pic
      FROM community_bookmark cb
      JOIN post_in_community p
        ON p.post_commu_id=cb.post_commu_id
      JOIN user_sys u
        ON u.user_sys_id=p.user_sys_id
      WHERE cb.user_sys_id=$1
      ORDER BY cb.saved_at DESC
      `,
        [userId],
      );
      return {
        success: true,
        data: result,
        message: 'Bookmarks fetched successfully!',
      };
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
      throw new InternalServerErrorException('Error fetching bookmarks');
    }
  }

  async checkBookmark(userId: number, postId: number) {
    try {
      const result = await this.dataSource.query(
        `
    SELECT 1
    FROM community_bookmark
    WHERE user_sys_id=$1
      AND post_commu_id=$2
    `,
        [userId, postId],
      );

      const bookmarkData = {
        bookmarked: result.length > 0,
      };

      return {
        success: true,
        data: bookmarkData,
        message: 'Bookmark status checked successfully!',
      };
    } catch (error) {
      console.error('Error checking bookmark:', error);
      throw new InternalServerErrorException('Error checking bookmark');
    }
  }
}
