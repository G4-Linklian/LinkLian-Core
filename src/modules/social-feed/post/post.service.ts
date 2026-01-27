// post.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PostContent } from './entities/post-content.entity';
import { PostInClass } from './entities/post-in-class.entity';
import { PostAttachment } from './entities/post-attachment.entity';
import { CreatePostDto, UpdatePostDto, GetPostsInClassDto, PostWithUserResponse } from './dto/post.dto';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostContent)
    private postContentRepo: Repository<PostContent>,
    @InjectRepository(PostInClass)
    private postInClassRepo: Repository<PostInClass>,
    @InjectRepository(PostAttachment)
    private postAttachmentRepo: Repository<PostAttachment>,
    private dataSource: DataSource,
  ) {}

  /**
   * Check if user is in section (authorization)
   * - Student: check enrollment table
   * - Teacher: check section_educator table
   */
  async checkUserInSection(userId: number, sectionId: number, role: string): Promise<boolean> {
    let query = '';
    let params: any[] = [];

    // Student roles
    if (role === 'high school student' || role === 'uni student') {
      query = `
        SELECT 1
        FROM enrollment
        WHERE student_id = $1
          AND section_id = $2
          AND flag_valid = true
        LIMIT 1
      `;
      params = [userId, sectionId];
    }
    // Teacher roles
    else if (role === 'teacher' || role === 'instructor') {
      query = `
        SELECT 1
        FROM section_educator
        WHERE educator_id = $1
          AND section_id = $2
          AND flag_valid = true
        LIMIT 1
      `;
      params = [userId, sectionId];
    } else {
      return false;
    }

    const result = await this.dataSource.query(query, params);
    return result.length > 0;
  }

  /**
   * Get posts in a class/section with optional filter by post type
   * Returns posts with user info (handles anonymous posts)
   */
  async getPostsInClass(dto: GetPostsInClassDto): Promise<PostWithUserResponse[]> {
    const values: any[] = [dto.section_id];
    let idx = 2;

    let conditions = `
      pic.section_id = $1
      AND pic.flag_valid = true
      AND pc.flag_valid = true
    `;

    // Filter by post type if provided
    if (dto.type) {
      conditions += ` AND pc.post_type = $${idx}`;
      values.push(dto.type);
      idx++;
    }

    const query = `
      SELECT
        pic.post_id,            
        pc.post_content_id,
        pc.title,
        pc.content,
        pc.post_type,
        pc.is_anonymous,
        pc.created_at,

        u.user_sys_id        AS _user_sys_id,
        u.email              AS _email,
        u.profile_pic        AS _profile_pic,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS _display_name,
        r.role_name          AS _role_name,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'file_url', pa.file_url,
              'file_type', pa.file_type
            )
          ) FILTER (
            WHERE pa.attachment_id IS NOT NULL
              AND pa.flag_valid = true
          ),
          '[]'
        ) AS attachments

      FROM post_in_class pic
      JOIN post_content pc
        ON pic.post_content_id = pc.post_content_id

      JOIN user_sys u
        ON pc.user_sys_id = u.user_sys_id

      JOIN role r
        ON u.role_id = r.role_id
       AND r.flag_valid = true

      LEFT JOIN post_attachment pa
        ON pc.post_content_id = pa.post_content_id

      WHERE ${conditions}

      GROUP BY
        pic.post_id, 
        pc.post_content_id,
        u.user_sys_id,
        u.first_name,
        u.middle_name,
        u.last_name,
        u.email,
        u.profile_pic,
        r.role_name

      ORDER BY pc.created_at DESC
    `;

    try {
      const result = await this.dataSource.query(query, values);

      // Transform result to handle anonymous posts
      return result.map((row: any) => ({
        post_id: row.post_id,
        post_content_id: row.post_content_id,
        title: row.title,
        content: row.content,
        post_type: row.post_type,
        is_anonymous: row.is_anonymous,
        created_at: row.created_at,
        user: row.is_anonymous ? null : {
          user_sys_id: row._user_sys_id,
          email: row._email,
          profile_pic: row._profile_pic,
          display_name: row._display_name,
          role_name: row._role_name,
        },
        attachments: row.attachments || [],
      }));

    } catch (error) {
      console.error('Error getting posts in class:', error);
      throw new InternalServerErrorException('Error fetching posts');
    }
  }

  /**
   * Create a new post in class with attachments (using transaction)
   */
  async createPost(userId: number, dto: CreatePostDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Insert post_content
      const postContentQuery = `
        INSERT INTO post_content
          (user_sys_id, title, content, post_type, is_anonymous)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          post_content_id,
          user_sys_id,
          title,
          content,
          post_type,
          is_anonymous,
          created_at
      `;

      const postContentResult = await queryRunner.query(postContentQuery, [
        userId,
        dto.title || null,
        dto.content || null,
        dto.post_type || null,
        dto.is_anonymous || false,
      ]);

      const postContent = postContentResult[0];

      // 2. Insert post_in_class (bind to section)
      const postInClassQuery = `
        INSERT INTO post_in_class
          (post_content_id, section_id)
        VALUES ($1, $2)
        RETURNING post_id
      `;

      const postInClassResult = await queryRunner.query(postInClassQuery, [
        postContent.post_content_id,
        dto.section_id,
      ]);

      const postInClass = postInClassResult[0];

      // 3. Insert attachments if any
      const attachments: any[] = [];
      if (dto.attachments && dto.attachments.length > 0) {
        for (const attachment of dto.attachments) {
          const attachmentQuery = `
            INSERT INTO post_attachment
              (post_content_id, file_url, file_type)
            VALUES ($1, $2, $3)
            RETURNING attachment_id, file_url, file_type
          `;

          const attachmentResult = await queryRunner.query(attachmentQuery, [
            postContent.post_content_id,
            attachment.file_url,
            attachment.file_type,
          ]);

          attachments.push(attachmentResult[0]);
        }
      }

      await queryRunner.commitTransaction();

      return {
        message: 'Post created successfully',
        data: {
          post_id: postInClass.post_id,
          post_content_id: postContent.post_content_id,
          title: postContent.title,
          content: postContent.content,
          post_type: postContent.post_type,
          is_anonymous: postContent.is_anonymous,
          created_at: postContent.created_at,
          attachments,
        },
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error creating post:', error);
      throw new InternalServerErrorException('Error creating post');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Find post owner (for permission check)
   */
  async findPostOwner(postId: number): Promise<{ post_content_id: number; user_sys_id: number }> {
    const query = `
      SELECT
        pc.post_content_id,
        pc.user_sys_id,
        pic.flag_valid AS pic_flag_valid,
        pc.flag_valid AS pc_flag_valid
      FROM post_in_class pic
      JOIN post_content pc
        ON pic.post_content_id = pc.post_content_id
      WHERE pic.post_id = $1
    `;

    const result = await this.dataSource.query(query, [postId]);

    if (!result.length) {
      throw new NotFoundException('Post not found');
    }

    const owner = result[0];

    // Check if post is soft deleted
    if (owner.pic_flag_valid === false || owner.pc_flag_valid === false) {
      throw new NotFoundException('Post not found');
    }

    return {
      post_content_id: owner.post_content_id,
      user_sys_id: owner.user_sys_id,
    };
  }

  /**
   * Update post content (only owner can update)
   */
  async updatePost(userId: number, postId: number, dto: UpdatePostDto) {
    // Check ownership
    const owner = await this.findPostOwner(postId);

    if (owner.user_sys_id !== userId) {
      throw new ForbiddenException('You are not allowed to update this post');
    }

    const query = `
      UPDATE post_content
      SET title = $1,
          content = $2,
          updated_at = NOW()
      WHERE post_content_id = $3
        AND flag_valid = true
      RETURNING *
    `;

    try {
      const result = await this.dataSource.query(query, [
        dto.title,
        dto.content,
        owner.post_content_id,
      ]);

      if (!result.length) {
        throw new NotFoundException('Post not found');
      }

      return { message: 'Post updated successfully', data: result[0] };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Error updating post:', error);
      throw new InternalServerErrorException('Error updating post');
    }
  }

  /**
   * Soft delete post and its attachments (only owner can delete)
   */
  async deletePost(userId: number, postId: number) {
    // Check ownership
    const owner = await this.findPostOwner(postId);

    if (owner.user_sys_id !== userId) {
      throw new ForbiddenException('You are not allowed to delete this post');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Soft delete post_in_class
      const deletePostQuery = `
        UPDATE post_in_class
        SET flag_valid = false,
            updated_at = NOW()
        WHERE post_id = $1
        RETURNING post_id
      `;

      await queryRunner.query(deletePostQuery, [postId]);

      // 2. Soft delete attachments
      const deleteAttachmentsQuery = `
        UPDATE post_attachment
        SET flag_valid = false,
            updated_at = NOW()
        WHERE post_content_id = $1
          AND flag_valid = true
        RETURNING attachment_id
      `;

      await queryRunner.query(deleteAttachmentsQuery, [owner.post_content_id]);

      await queryRunner.commitTransaction();

      return { message: 'Post deleted successfully', data: { post_id: postId } };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error deleting post:', error);
      throw new InternalServerErrorException('Error deleting post');
    } finally {
      await queryRunner.release();
    }
  }
}
