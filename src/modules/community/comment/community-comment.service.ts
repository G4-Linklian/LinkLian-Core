import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CommunityCommentService {
  constructor(private dataSource: DataSource) { }

  async getComments(dto: any) {
    const { post_commu_id, limit = 10, offset = 0 } = dto;

    if (!post_commu_id) {
      throw new BadRequestException('post_commu_id is required');
    }

    try {
      const countResult = await this.dataSource.query(
        `
    SELECT COUNT(*) as total
    FROM community_comment c
    WHERE c.post_commu_id=$1
      AND c.flag_valid=true
      AND NOT EXISTS (
        SELECT 1 FROM community_comment_path p
        WHERE p.descendant_id=c.commu_comment_id
          AND p.path_length=1
          AND p.flag_valid=true
      )
    `,
        [post_commu_id],
      );

      const total = parseInt(countResult[0]?.total || '0', 10);

      const roots = await this.dataSource.query(
        `
  SELECT
    c.commu_comment_id AS comment_id,
    c.post_commu_id,
    c.user_sys_id,
    c.comment_text,
    c.created_at,
    c.updated_at,
    c.flag_valid,
    NULL AS parent_id,

    (
      SELECT COUNT(*)
      FROM community_comment_path
      WHERE ancestor_id = c.commu_comment_id
        AND path_length = 1
        AND flag_valid = true
    ) AS children_count,

    CONCAT(u.first_name,' ',u.last_name) AS display_name,
    u.profile_pic

  FROM community_comment c
  LEFT JOIN user_sys u
    ON c.user_sys_id = u.user_sys_id

  WHERE c.post_commu_id=$1
    AND c.flag_valid=true
    AND NOT EXISTS (
      SELECT 1 FROM community_comment_path p
      WHERE p.descendant_id=c.commu_comment_id
        AND p.path_length=1
        AND p.flag_valid=true
    )
  ORDER BY c.created_at DESC
  LIMIT $2 OFFSET $3
  `,
        [post_commu_id, limit, offset],
      );

      const tree = await Promise.all(
        roots.map(async (r: any) => ({
          ...r,
          children: await this.fetchChildren(r.comment_id),
        })),
      );
      const commentData = {
        comments: tree,
        total,
        hasMore: offset + limit < total,
      };

      return {
        success: true,
        data: commentData,
        message: 'Comments fetched successfully!',
      };
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw new InternalServerErrorException('Error fetching comments');
    }
  }

  private async fetchChildren(parentId: number) {
    const children = await this.dataSource.query(
      `
      SELECT
        c.commu_comment_id AS comment_id,
        c.post_commu_id,
        c.user_sys_id,
        c.comment_text,
        c.created_at,
        c.updated_at,
        c.flag_valid,
        $1 AS parent_id,

        (
          SELECT COUNT(*)
          FROM community_comment_path
          WHERE ancestor_id=c.commu_comment_id
            AND path_length=1
            AND flag_valid=true
        ) AS children_count,

        CONCAT(u.first_name,' ',u.last_name) AS display_name,
        u.profile_pic

      FROM community_comment c
      LEFT JOIN user_sys u
        ON c.user_sys_id=u.user_sys_id

      JOIN community_comment_path p
        ON p.descendant_id=c.commu_comment_id
       AND p.path_length=1
       AND p.ancestor_id=$1
       AND p.flag_valid=true

      WHERE c.flag_valid=true
      ORDER BY c.created_at ASC
      `,
      [parentId],
    );

    return Promise.all(
      children.map(async (c: any) => ({
        ...c,
        children: await this.fetchChildren(c.comment_id),
      })),
    );
  }
  async createComment(userId: number, dto: any) {
    const { post_commu_id, comment_text, parent_id } = dto;

    if (!post_commu_id || !comment_text) {
      throw new BadRequestException('Invalid data');
    }
    const post = await this.dataSource.query(
      `
      
     SELECT c.status,
         c.is_private,
         c.community_id
  FROM post_in_community p
  JOIN community c
    ON c.community_id = p.community_id
  WHERE p.post_commu_id=$1
    AND p.flag_valid=true
      `,
      [post_commu_id],
    );

    if (!post.length) {
      throw new BadRequestException('Post not found');
    }

    if (post[0].status !== 'active') {
      throw new ForbiddenException('Community is inactive');
    }
    if (post[0].is_private) {

      const member = await this.dataSource.query(`
    SELECT 1
    FROM community_member
    WHERE community_id=$1
      AND user_sys_id=$2
      AND status='active'
      AND flag_valid=true
  `, [post[0].community_id, userId]);

      if (!member.length) {
        throw new ForbiddenException('Private community');
      }
    }



    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const insert = await queryRunner.query(
        `
        INSERT INTO community_comment
        (post_commu_id,user_sys_id,comment_text,created_at,updated_at,flag_valid)
        VALUES ($1,$2,$3,now(),now(),true)
        RETURNING commu_comment_id
        `,
        [post_commu_id, userId, comment_text],
      );

      const newId = insert[0].commu_comment_id;

      await queryRunner.query(
        `
        INSERT INTO community_comment_path
        (ancestor_id,descendant_id,path_length,flag_valid)
        VALUES ($1,$1,0,true)
        `,
        [newId],
      );

      if (parent_id) {
        await queryRunner.query(
          `
          INSERT INTO community_comment_path
          (ancestor_id,descendant_id,path_length,flag_valid)
          SELECT ancestor_id,$1,path_length+1,true
          FROM community_comment_path
          WHERE descendant_id=$2
            AND flag_valid=true
          `,
          [newId, parent_id],
        );
      }

      await queryRunner.commitTransaction();
      const commentData = { comment_id: newId };

      return {
        success: true,
        message: 'Comment created successfully',
        data: commentData,
      };
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }


  async updateComment(userId: number, dto: any) {
    const { comment_id, comment_text } = dto;
    const post = await this.dataSource.query(`
  SELECT c.status
  FROM community_comment cc
  JOIN post_in_community p ON p.post_commu_id = cc.post_commu_id
  JOIN community c ON c.community_id = p.community_id
  WHERE cc.commu_comment_id=$1
`, [comment_id]);

    if (!post.length)
      throw new BadRequestException('Comment not found');

    if (post[0].status !== 'active')
      throw new ForbiddenException('Community is inactive');

    try {
      const result = await this.dataSource.query(
        `
      UPDATE community_comment
      SET comment_text=$1, updated_at=now()
      WHERE commu_comment_id=$2
        AND user_sys_id=$3
        AND flag_valid=true
      RETURNING *
      `,
        [comment_text, comment_id, userId],
      );

      if (!result.length) {
        throw new ForbiddenException('Not allowed');
      }

      return {
        success: true, data: { comment_id },
        message: 'Comment updated successfully!',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      console.error('Error updating comment:', error);
      throw new InternalServerErrorException('Error updating comment');
    }
  }

  async hardDeleteComment(userId: number, commentId: number) {

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

      const check = await queryRunner.query(
        `
      SELECT user_sys_id
      FROM community_comment
      WHERE commu_comment_id=$1
      `,
        [commentId],
      );

      if (!check.length)
        throw new BadRequestException('Comment not found');

      if (Number(check[0].user_sys_id) !== userId)
        throw new ForbiddenException('Not allowed');


      const descendants = await queryRunner.query(`
      SELECT descendant_id
      FROM community_comment_path
      WHERE ancestor_id=$1
    `, [commentId]);

      const ids = descendants.map((d: any) => d.descendant_id);

      if (!ids.length) {
        await queryRunner.commitTransaction();
        return { success: true };
      }

      await queryRunner.query(`
      DELETE FROM community_comment
      WHERE commu_comment_id = ANY($1)
    `, [ids]);

      await queryRunner.query(`
      DELETE FROM community_comment_path
      WHERE descendant_id = ANY($1)
    `, [ids]);

      await queryRunner.commitTransaction();
      return {
        success: true, data: { deleted_ids: ids },
        message: 'Comment deleted successfully!',
      };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Compatibility wrapper used by controller/tests
  async deleteComment(userId: number, commentId: number) {
    return this.hardDeleteComment(userId, commentId);
  }

}
