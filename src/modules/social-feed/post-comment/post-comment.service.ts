// post-comment.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PostComment } from './entities/post-comment.entity';
import { PostCommentPath } from './entities/post-comment-path.entity';
import {
  GetPostCommentsDto,
  CreatePostCommentDto,
  UpdatePostCommentDto,
  DeletePostCommentDto,
  CommentNode,
} from './dto/post-comment.dto';
import { generateAnonymousName } from '../../../common/utils/anonymous.util';

@Injectable()
export class PostCommentService {
  constructor(
    @InjectRepository(PostComment)
    private postCommentRepo: Repository<PostComment>,
    @InjectRepository(PostCommentPath)
    private postCommentPathRepo: Repository<PostCommentPath>,
    private dataSource: DataSource,
  ) {}

  /**
   * Build comment tree from flat list (closure table pattern)
   * Converts flat array to nested tree structure
   */
  private buildCommentTree(comments: any[]): CommentNode[] {
    const map = new Map<number, CommentNode>();
    const roots: CommentNode[] = [];

    // Create map of all comments with empty children array
    comments.forEach((c) => {
      map.set(c.comment_id, {
        ...c,
        children: [],
      });
    });

    // Build tree by linking children to parents
    map.forEach((c) => {
      if (c.parent_id) {
        const parent = map.get(c.parent_id);
        if (parent) {
          parent.children.push(c);
        }
      } else {
        roots.push(c);
      }
    });

    return roots;
  }

  /**
   * Get all comments for a post as a nested tree structure with pagination
   * Handles anonymous display names using section-based hashing
   */
  async getPostComments(
    dto: GetPostCommentsDto,
  ): Promise<{ data: CommentNode[]; total: number; hasMore: boolean }> {
    const { post_id, limit = 10, offset = 0 } = dto;

    if (!post_id) {
      throw new BadRequestException('post_id is required');
    }

    try {
      // Count total root comments (comments without parent)
      const countQuery = `
        SELECT COUNT(*) as total
        FROM post_comment c
        WHERE c.post_id = $1
          AND c.flag_valid = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM post_comment_path pcp
            WHERE pcp.descendant_id = c.comment_id
              AND pcp.path_length = 1
              AND pcp.flag_valid = TRUE
          )
      `;
      const countResult = await this.dataSource.query(countQuery, [post_id]);
      const total = parseInt(countResult[0]?.total || '0', 10);

      // Query root comments with pagination
      const rootQuery = `
        SELECT
          c.comment_id,
          c.post_id,
          c.user_sys_id,
          c.is_anonymous,
          c.comment_text,
          c.created_at,
          c.updated_at,
          c.flag_valid,
          NULL AS parent_id,

          -- Count immediate children
          (
            SELECT COUNT(*)
            FROM post_comment_path
            WHERE ancestor_id = c.comment_id
              AND path_length = 1
              AND flag_valid = TRUE
          ) AS children_count,

          -- Display name (null if anonymous)
          CASE
            WHEN c.is_anonymous THEN NULL
            ELSE CONCAT(u.first_name, ' ', u.last_name)
          END AS display_name,

          -- Profile pic (null if anonymous)
          CASE
            WHEN c.is_anonymous THEN NULL
            ELSE u.profile_pic
          END AS profile_pic

        FROM post_comment c
        LEFT JOIN user_sys u ON c.user_sys_id = u.user_sys_id
        WHERE c.post_id = $1
          AND c.flag_valid = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM post_comment_path pcp
            WHERE pcp.descendant_id = c.comment_id
              AND pcp.path_length = 1
              AND pcp.flag_valid = TRUE
          )
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const rootComments = await this.dataSource.query(rootQuery, [
        post_id,
        limit,
        offset,
      ]);

      // Get section_id for anonymous name generation if needed
      let sectionIdForAnonymous: number | null = null;
      const sectionQuery = `
        SELECT section_id
        FROM post_in_class
        WHERE post_id = $1
        LIMIT 1
      `;
      const sectionRes = await this.dataSource.query(sectionQuery, [post_id]);
      sectionIdForAnonymous = sectionRes[0]?.section_id ?? null;

      // For each root comment, fetch all descendants recursively
      const commentsWithChildren = await Promise.all(
        rootComments.map(async (root: any) => {
          const processedRoot = this.processAnonymousComment(
            root,
            sectionIdForAnonymous,
          );
          const children = await this.fetchChildrenRecursive(
            root.comment_id,
            sectionIdForAnonymous,
          );
          return { ...processedRoot, children };
        }),
      );

      return {
        data: commentsWithChildren,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error('getPostComments error:', error);
      throw new InternalServerErrorException('Error fetching comments');
    }
  }

  /**
   * Recursively fetch all children of a comment
   */
  private async fetchChildrenRecursive(
    parentId: number,
    sectionIdForAnonymous: number | null,
  ): Promise<any[]> {
    const childrenQuery = `
      SELECT
        c.comment_id,
        c.post_id,
        c.user_sys_id,
        c.is_anonymous,
        c.comment_text,
        c.created_at,
        c.updated_at,
        c.flag_valid,
        $1 AS parent_id,

        -- Count immediate children
        (
          SELECT COUNT(*)
          FROM post_comment_path
          WHERE ancestor_id = c.comment_id
            AND path_length = 1
            AND flag_valid = TRUE
        ) AS children_count,

        CASE
          WHEN c.is_anonymous THEN NULL
          ELSE CONCAT(u.first_name, ' ', u.last_name)
        END AS display_name,

        CASE
          WHEN c.is_anonymous THEN NULL
          ELSE u.profile_pic
        END AS profile_pic

      FROM post_comment c
      LEFT JOIN user_sys u ON c.user_sys_id = u.user_sys_id
      JOIN post_comment_path pcp 
        ON pcp.descendant_id = c.comment_id 
        AND pcp.path_length = 1
        AND pcp.ancestor_id = $1
      WHERE c.flag_valid = TRUE
        AND pcp.flag_valid = TRUE
      ORDER BY c.created_at ASC
    `;

    const children = await this.dataSource.query(childrenQuery, [parentId]);

    // Recursively fetch children for each child
    const childrenWithNested = await Promise.all(
      children.map(async (child: any) => {
        const processedChild = this.processAnonymousComment(
          child,
          sectionIdForAnonymous,
        );
        const nestedChildren = await this.fetchChildrenRecursive(
          child.comment_id,
          sectionIdForAnonymous,
        );
        return { ...processedChild, children: nestedChildren };
      }),
    );

    return childrenWithNested;
  }

  /**
   * Process anonymous comment to generate display name
   */
  private processAnonymousComment(
    comment: any,
    sectionIdForAnonymous: number | null,
  ): any {
    if (comment.is_anonymous && sectionIdForAnonymous) {
      return {
        ...comment,
        display_name: generateAnonymousName(
          comment.user_sys_id,
          sectionIdForAnonymous,
        ),
        profile_pic: null,
      };
    }
    return comment;
  }

  /**
   * Create a new comment with closure table path entries
   * Uses transaction to ensure data consistency
   */
  async createPostComment(userId: number, dto: CreatePostCommentDto) {
    const { post_id, comment_text, is_anonymous, parent_id } = dto;

    if (!post_id || !comment_text) {
      throw new BadRequestException('post_id and comment_text are required');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Insert the comment
      const insertCommentQuery = `
        INSERT INTO post_comment (
          post_id, user_sys_id, is_anonymous, comment_text, created_at, updated_at, flag_valid
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW(), TRUE)
        RETURNING comment_id
      `;
      const insertCommentResult = await queryRunner.query(insertCommentQuery, [
        post_id,
        userId,
        is_anonymous || false,
        comment_text,
      ]);

      if (!insertCommentResult || insertCommentResult.length === 0) {
        throw new InternalServerErrorException('Failed to insert comment');
      }

      const newCommentId = insertCommentResult[0].comment_id;

      // 2. Insert self path (path_length = 0)
      const insertSelfPathQuery = `
        INSERT INTO post_comment_path (
          ancestor_id, descendant_id, path_length, flag_valid
        )
        VALUES ($1, $1, 0, TRUE)
      `;
      await queryRunner.query(insertSelfPathQuery, [newCommentId]);

      // 3. Insert reply paths if parent_id exists (copy all ancestor paths)
      if (parent_id) {
        const insertReplyQuery = `
          INSERT INTO post_comment_path (
            ancestor_id, descendant_id, path_length, flag_valid
          )
          SELECT ancestor_id, $1, path_length + 1, TRUE
          FROM post_comment_path
          WHERE descendant_id = $2 AND flag_valid = TRUE
        `;
        await queryRunner.query(insertReplyQuery, [newCommentId, parent_id]);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Comment created successfully',
        data: {
          comment_id: newCommentId,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('createPostComment error:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Error creating comment');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update an existing comment (only owner can update)
   */
  async updatePostComment(userId: number, dto: UpdatePostCommentDto) {
    const { comment_id, comment_text, flag_valid } = dto;

    if (!comment_id) {
      throw new BadRequestException('comment_id is required');
    }

    if (!comment_text && flag_valid === undefined) {
      throw new BadRequestException('No fields to update');
    }

    try {
      // Build dynamic update query
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (comment_text) {
        setClauses.push(`comment_text = $${paramIndex++}`);
        values.push(comment_text);
      }

      if (typeof flag_valid === 'boolean') {
        setClauses.push(`flag_valid = $${paramIndex++}`);
        values.push(flag_valid);
      }

      setClauses.push('updated_at = NOW()');

      const query = `
        UPDATE post_comment
        SET ${setClauses.join(', ')}
        WHERE comment_id = $${paramIndex++}
          AND user_sys_id = $${paramIndex++}
        RETURNING *
      `;

      values.push(comment_id, userId);

      const result = await this.dataSource.query(query, values);

      if (result.length === 0) {
        throw new NotFoundException('Comment not found or unauthorized');
      }

      return {
        success: true,
        message: 'Comment updated successfully',
        data: result[0],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('updatePostComment error:', error);
      throw new InternalServerErrorException('Error updating comment');
    }
  }

  /**
   * Soft delete a comment and all its descendants
   * Owner or post owner can delete
   * Uses transaction for consistency
   */
  async deletePostComment(userId: number, dto: DeletePostCommentDto) {
    const { comment_id } = dto;

    if (!comment_id) {
      throw new BadRequestException('comment_id is required');
    }

    try {
      // Check permission: comment owner or post owner can delete
      const checkQuery = `
        SELECT c.comment_id, c.flag_valid
        FROM post_comment c
        WHERE c.comment_id = $1
          AND (c.user_sys_id = $2 
            OR EXISTS (
              SELECT 1 FROM post_in_class pic
              JOIN post_content pc ON pic.post_content_id = pc.post_content_id
              WHERE pic.post_id = c.post_id AND pc.user_sys_id = $2
            ))
      `;

      const checkResult = await this.dataSource.query(checkQuery, [
        comment_id,
        userId,
      ]);

      if (!checkResult || checkResult.length === 0) {
        throw new ForbiddenException('Unauthorized or comment not found');
      }

      if (checkResult[0].flag_valid === false) {
        throw new BadRequestException('This comment is already deleted');
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. Soft delete comment and all descendants
        const deleteCommentQuery = `
          UPDATE post_comment
          SET flag_valid = FALSE, updated_at = NOW()
          WHERE comment_id IN (
            SELECT descendant_id
            FROM post_comment_path
            WHERE ancestor_id = $1 AND flag_valid = TRUE
          )
          RETURNING comment_id
        `;
        const deleteCommentResult = await queryRunner.query(
          deleteCommentQuery,
          [comment_id],
        );

        // 2. Mark paths as invalid
        const deletePathQuery = `
          UPDATE post_comment_path
          SET flag_valid = FALSE
          WHERE descendant_id IN (
            SELECT descendant_id
            FROM post_comment_path
            WHERE ancestor_id = $1 AND flag_valid = TRUE
          )
        `;
        await queryRunner.query(deletePathQuery, [comment_id]);

        await queryRunner.commitTransaction();

        return {
          success: true,
          message: 'Comment and its replies deleted successfully',
          data: {
            deleted_count: deleteCommentResult.length,
            deleted_comment_ids: deleteCommentResult.map(
              (row: any) => row.comment_id,
            ),
          },
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      console.error('deletePostComment error:', error);
      throw new InternalServerErrorException('Error deleting comment');
    }
  }
}
