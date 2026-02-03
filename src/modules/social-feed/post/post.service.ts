// post.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PostContent } from './entities/post-content.entity';
import { PostInClass } from './entities/post-in-class.entity';
import { PostAttachment } from './entities/post-attachment.entity';
import { CreatePostDto, UpdatePostDto, GetPostsInClassDto, SearchPostDto } from './dto/post.dto';
import { generateAnonymousName } from '../../../common/utils/anonymous.util';

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
   * Get posts in a class (section)
   */
  async getPostsInClass(dto: GetPostsInClassDto): Promise<any[]> {
    console.log(`[GetPostsInClass] Fetching posts for section_id: ${dto.section_id}`);
    
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
              'file_type', pa.file_type,
              'original_name', pa.original_name
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
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    // Add limit and offset to values
    values.push(dto.limit || 10);
    values.push(dto.offset || 0);

    try {
      const result = await this.dataSource.query(query, values);

      console.log(`[GetPostsInClass] Query returned ${result.length} posts`);
      
      // Log first post's attachments for debugging
      if (result.length > 0 && result[0].attachments) {
        console.log(`[GetPostsInClass] First post attachments sample:`, result[0].attachments);
      }

      // Transform result to handle anonymous posts
      return result.map((row: any) => {
        const isAnonymous = row.is_anonymous;
        const userSysId = Number(row._user_sys_id);
        const sectionId = dto.section_id;

        // Generate anonymous name if is_anonymous is true
        const displayName = isAnonymous
          ? generateAnonymousName(userSysId, sectionId)
          : row._display_name;

        return {
          post_id: row.post_id,
          post_content_id: row.post_content_id,
          title: row.title,
          content: row.content,
          post_type: row.post_type,
          is_anonymous: isAnonymous,
          created_at: row.created_at,
          // For anonymous: still return user object but with generated name and null sensitive info
          user: isAnonymous ? {
            user_sys_id: userSysId,
            email: null,
            profile_pic: null,
            display_name: displayName,
            role_name: null,
          } : {
            user_sys_id: userSysId,
            email: row._email,
            profile_pic: row._profile_pic,
            display_name: row._display_name,
            role_name: row._role_name,
          },
          attachments: row.attachments || [],
        };
      });

    } catch (error) {
      console.error('Error getting posts in class:', error);
      throw new InternalServerErrorException('Error fetching posts');
    }
  }

  /**
   * Create a new post in class with attachments (using transaction)
   * Supports multiple section_ids (post to multiple classes at once)
   */
  async createPost(userId: number, dto: CreatePostDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const warnings: any[] = [];

    try {
      // Determine section_ids (support both single and multiple)
      let sectionIds: number[] = [];
      
      if (Array.isArray(dto.section_ids) && dto.section_ids.length > 0) {
        sectionIds = dto.section_ids;
      } else if (dto.section_id) {
        sectionIds = [dto.section_id];
      }

      if (sectionIds.length === 0) {
        throw new BadRequestException('section_id or section_ids is required');
      }

      // Validate required fields
      if (!dto.title && !dto.content) {
        throw new BadRequestException('title or content is required');
      }

      if (!dto.post_type) {
        throw new BadRequestException('post_type is required');
      }

      // Strict validation for attachments
      if (dto.attachments && dto.attachments.length > 0) {
        console.log(`[CreatePost] Validating ${dto.attachments.length} attachments strictly`);
        
        const invalidAttachments = dto.attachments.filter(f => !f.file_url || !f.file_type);
        
        if (invalidAttachments.length > 0) {
          console.error(`[CreatePost] Found ${invalidAttachments.length} invalid attachments`);
          throw new BadRequestException(
            `มีไฟล์แนบ ${invalidAttachments.length} ไฟล์ที่ไม่สมบูรณ์ กรุณาลองอัปโหลดใหม่อีกครั้ง`
          );
        }
        
        // Check for duplicate URLs
        const urls = dto.attachments.map(a => a.file_url);
        const uniqueUrls = new Set(urls);
        if (urls.length !== uniqueUrls.size) {
          console.error(`[CreatePost] Found duplicate file URLs`);
          throw new BadRequestException('พบไฟล์ซ้ำ กรุณาตรวจสอบไฟล์แนบ');
        }
        
        console.log(`[CreatePost] All ${dto.attachments.length} attachments are valid`);
      }

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

      // 2. Bind to multiple classes (post_in_class)
      const postIds: number[] = [];
      for (const sectionId of sectionIds) {
        const postInClassQuery = `
          INSERT INTO post_in_class
            (post_content_id, section_id)
          VALUES ($1, $2)
          RETURNING post_id
        `;

        const postInClassResult = await queryRunner.query(postInClassQuery, [
          postContent.post_content_id,
          sectionId,
        ]);

        if (postInClassResult[0]) {
          postIds.push(postInClassResult[0].post_id);
        }
      }

      // 3. Insert attachments if any - MUST succeed all or rollback
      const attachments: any[] = [];
      if (dto.attachments && dto.attachments.length > 0) {
        console.log(`[CreatePost] Processing ${dto.attachments.length} attachments (strict mode)`);
        
        for (const attachment of dto.attachments) {
          console.log(`[CreatePost] Attachment data:`, {
            file_url: attachment.file_url,
            file_type: attachment.file_type,
            original_name: attachment.original_name
          });

          const attachmentQuery = `
            INSERT INTO post_attachment
              (post_content_id, file_url, file_type, original_name)
            VALUES ($1, $2, $3, $4)
            RETURNING attachment_id, file_url, file_type, original_name
          `;

          console.log(`[CreatePost] Inserting attachment with params:`, {
            post_content_id: postContent.post_content_id,
            file_url: attachment.file_url,
            file_type: attachment.file_type,
            original_name: attachment.original_name || null
          });

          const attachmentResult = await queryRunner.query(attachmentQuery, [
            postContent.post_content_id,
            attachment.file_url,
            attachment.file_type,
            attachment.original_name || null,
          ]);

          console.log(`[CreatePost] Attachment inserted successfully:`, attachmentResult[0]);
          attachments.push(attachmentResult[0]);
        }
        
        console.log(`[CreatePost] All ${attachments.length} attachments inserted successfully`);
      } else {
        console.log(`[CreatePost] No attachments to process`);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Post created successfully',
        data: {
          post_ids: postIds,
          post_content_id: postContent.post_content_id,
          title: postContent.title,
          content: postContent.content,
          post_type: postContent.post_type,
          is_anonymous: postContent.is_anonymous,
          created_at: postContent.created_at,
          section_ids: sectionIds,
          attachments,
        },
        warnings: warnings.length > 0 ? warnings : null,
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error creating post:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
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
   * Accepts either postId (post_in_class.post_id) or post_content_id
   * Also handles attachment updates (add/remove)
   */
  async updatePost(userId: number, postId: number, dto: UpdatePostDto, postContentId?: number) {
    try {
      let targetPostContentId: number;
      let ownerUserId: number;

      console.log(`[UpdatePost] userId=${userId}, postId=${postId}, postContentId=${postContentId}`);

      // If postContentId is provided directly, use it
      if (postContentId && postContentId > 0) {
        const ownerQuery = `
          SELECT user_sys_id, post_content_id
          FROM post_content
          WHERE post_content_id = $1 AND flag_valid = true
        `;
        const result = await this.dataSource.query(ownerQuery, [postContentId]);
        console.log(`[UpdatePost] Query result:`, result);
        
        if (!result.length) {
          throw new NotFoundException('Post not found');
        }
        targetPostContentId = postContentId;
        ownerUserId = Number(result[0].user_sys_id);
      } else if (postId && postId > 0) {
        // Check ownership by postId
        const owner = await this.findPostOwner(postId);
        targetPostContentId = owner.post_content_id;
        ownerUserId = owner.user_sys_id;
      } else {
        throw new BadRequestException('post_id or post_content_id is required');
      }

      console.log(`[UpdatePost] targetPostContentId=${targetPostContentId}, ownerUserId=${ownerUserId}, requesterId=${userId}`);

      // Check ownership
      if (ownerUserId !== userId) {
        console.log(`[UpdatePost] Permission denied: owner=${ownerUserId}, requester=${userId}`);
        throw new ForbiddenException('You are not allowed to update this post');
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (dto.title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        values.push(dto.title);
      }

      if (dto.content !== undefined) {
        updateFields.push(`content = $${paramIndex++}`);
        values.push(dto.content);
      }

      updateFields.push('updated_at = NOW()');

      const query = `
        UPDATE post_content
        SET ${updateFields.join(', ')}
        WHERE post_content_id = $${paramIndex}
          AND flag_valid = true
        RETURNING *
      `;

      values.push(targetPostContentId);

      const result = await this.dataSource.query(query, values);

      if (!result.length) {
        throw new NotFoundException('Post not found');
      }

      // Handle attachments if provided (including empty array to clear all)
      if (dto.attachments !== undefined) {
        console.log(`[UpdatePost] Updating attachments: ${dto.attachments.length} files`);
        
        try {
          // Soft delete existing attachments
          console.log(`[UpdatePost] Soft deleting existing attachments for post_content_id: ${targetPostContentId}`);
          await this.dataSource.query(`
            UPDATE post_attachment
            SET flag_valid = false
            WHERE post_content_id = $1 AND flag_valid = true
          `, [targetPostContentId]);

          // Insert new attachments
          if (dto.attachments.length > 0) {
            for (const attachment of dto.attachments) {
              console.log(`[UpdatePost] Processing attachment:`, {
                file_url: attachment.file_url,
                file_type: attachment.file_type,
                original_name: attachment.original_name
              });

              if (!attachment.file_url || !attachment.file_type) {
                console.log(`[UpdatePost] Skipping invalid attachment:`, attachment);
                continue;
              }

              console.log(`[UpdatePost] Inserting attachment with original_name: ${attachment.original_name || 'NULL'}`);
              const result = await this.dataSource.query(`
                INSERT INTO post_attachment (post_content_id, file_url, file_type, original_name)
                VALUES ($1, $2, $3, $4)
                RETURNING attachment_id, file_url, file_type, original_name
              `, [
                targetPostContentId, 
                attachment.file_url, 
                attachment.file_type,
                attachment.original_name || null
              ]);
              
              console.log(`[UpdatePost] Attachment inserted:`, result[0]);
            }
          }
          
          console.log(`[UpdatePost] Attachments updated successfully`);
        } catch (attachmentError) {
          console.error(`[UpdatePost] Error updating attachments:`, attachmentError);
        }
      }

      return { 
        success: true,
        message: 'Post updated successfully', 
        data: result[0] 
      };

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error updating post:', error);
      throw new InternalServerErrorException('Error updating post');
    }
  }

  /**
   * Update post attachments (add new, remove deleted)
   */
  async updatePostAttachments(
    userId: number, 
    postContentId: number, 
    attachmentsToAdd: { file_url: string; file_type: string; original_name?: string }[],
    attachmentIdsToRemove: number[]
  ) {
    // Check ownership first
    const ownerQuery = `
      SELECT user_sys_id FROM post_content
      WHERE post_content_id = $1 AND flag_valid = true
    `;
    const ownerResult = await this.dataSource.query(ownerQuery, [postContentId]);
    
    if (!ownerResult.length) {
      throw new NotFoundException('Post not found');
    }
    
    if (Number(ownerResult[0].user_sys_id) !== userId) {
      throw new ForbiddenException('You are not allowed to update this post');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Remove attachments
      if (attachmentIdsToRemove.length > 0) {
        await queryRunner.query(`
          UPDATE post_attachment
          SET flag_valid = false
          WHERE attachment_id = ANY($1)
            AND post_content_id = $2
        `, [attachmentIdsToRemove, postContentId]);
      }

      // 2. Add new attachments
      const addedAttachments: any[] = [];
      for (const attachment of attachmentsToAdd) {
        const insertQuery = `
          INSERT INTO post_attachment (post_content_id, file_url, file_type, original_name)
          VALUES ($1, $2, $3, $4)
          RETURNING attachment_id, file_url, file_type, original_name
        `;
        
        const insertResult = await queryRunner.query(insertQuery, [
          postContentId,
          attachment.file_url,
          attachment.file_type,
          attachment.original_name || null,
        ]);

        addedAttachments.push(insertResult[0]);
      }

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Attachments updated successfully',
        data: {
          added: addedAttachments,
          removed: attachmentIdsToRemove,
        }
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Soft delete post and its attachments (only owner can delete)
   * Supports both post_id and post_content_id
   */
  async deletePost(userId: number, postId: number, postContentId?: number) {
    try {
      let targetPostContentId: number;
      let ownerUserId: number;

      console.log(`[DeletePost] userId=${userId}, postId=${postId}, postContentId=${postContentId}`);

      // If postContentId is provided, find owner by post_content_id
      if (postContentId && postContentId > 0) {
        const ownerQuery = `
          SELECT pc.user_sys_id, pc.post_content_id
          FROM post_content pc
          WHERE pc.post_content_id = $1 AND pc.flag_valid = true
        `;
        const result = await this.dataSource.query(ownerQuery, [postContentId]);
        console.log(`[DeletePost] Query result:`, result);
        
        if (!result.length) {
          throw new NotFoundException('Post not found');
        }
        targetPostContentId = postContentId;
        ownerUserId = Number(result[0].user_sys_id);
      } else if (postId && postId > 0) {
        // Check ownership by postId
        const owner = await this.findPostOwner(postId);
        targetPostContentId = owner.post_content_id;
        ownerUserId = Number(owner.user_sys_id);
      } else {
        throw new BadRequestException('post_id or post_content_id is required');
      }

      console.log(`[DeletePost] targetPostContentId=${targetPostContentId}, ownerUserId=${ownerUserId}, requesterId=${userId}`);

      // Check ownership
      if (ownerUserId !== userId) {
        console.log(`[DeletePost] Permission denied: owner=${ownerUserId}, requester=${userId}`);
        throw new ForbiddenException('You are not allowed to delete this post');
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. Soft delete post_in_class
        if (postId && postId > 0) {
          await queryRunner.query(`
            UPDATE post_in_class
            SET flag_valid = false
            WHERE post_id = $1
          `, [postId]);
        } else {
          await queryRunner.query(`
            UPDATE post_in_class
            SET flag_valid = false
            WHERE post_content_id = $1
          `, [targetPostContentId]);
        }

        // 2. Soft delete attachments
        await queryRunner.query(`
          UPDATE post_attachment
          SET flag_valid = false
          WHERE post_content_id = $1 AND flag_valid = true
        `, [targetPostContentId]);

        // 3. Soft delete post_content
        await queryRunner.query(`
          UPDATE post_content
          SET flag_valid = false, updated_at = NOW()
          WHERE post_content_id = $1
        `, [targetPostContentId]);

        await queryRunner.commitTransaction();

        console.log(`[DeletePost] Post deleted successfully`);

        return { 
          success: true,
          message: 'Post deleted successfully', 
          data: { post_id: postId, post_content_id: targetPostContentId } 
        };

      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error deleting post:', error);
      throw new InternalServerErrorException('Error deleting post');
    }
  }

  /**
   * Search posts by keyword
   * Searches in title and content
   */
  async searchPosts(dto: SearchPostDto) {
    const { section_id, keyword, limit = 50, offset = 0 } = dto;

    if (!keyword || keyword.trim() === '') {
      return [];
    }

    let query = `
      SELECT 
        p.post_id,
        p.section_id,
        pc.post_content_id,
        pc.title,
        pc.content,
        pc.post_type,
        pc.is_anonymous,
        pc.created_at,
        pc.user_sys_id,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) as _display_name,
        u.email,
        u.profile_pic,
        r.role_name,
        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'file_url', pa.file_url,
                'file_type', pa.file_type,
                'original_name', pa.original_name
              )
            )
            FROM post_attachment pa
            WHERE pa.post_content_id = pc.post_content_id
              AND pa.flag_valid = true
          ),
          '[]'::json
        ) AS attachments
      FROM post_in_class p
      JOIN post_content pc ON p.post_content_id = pc.post_content_id
      LEFT JOIN user_sys u ON pc.user_sys_id = u.user_sys_id
      LEFT JOIN role r ON u.role_id = r.role_id
      WHERE p.flag_valid = true
        AND pc.flag_valid = true
        AND (pc.title ILIKE $1 OR pc.content ILIKE $1)
    `;

    const values: any[] = [`%${keyword.trim()}%`];
    let paramIndex = 2;

    if (section_id) {
      query += ` AND p.section_id = $${paramIndex++}`;
      values.push(section_id);
    }

    query += ` ORDER BY pc.created_at DESC`;
    query += ` LIMIT $${paramIndex++}`;
    values.push(limit);
    query += ` OFFSET $${paramIndex++}`;
    values.push(offset);

    try {
      const result = await this.dataSource.query(query, values);
      
      // Transform result to handle anonymous posts (same as getPostsInClass)
      return result.map((row: any) => {
        const isAnonymous = row.is_anonymous;
        const userSysId = Number(row.user_sys_id);
        const sectionId = row.section_id;

        // Generate anonymous name if is_anonymous is true
        const displayName = isAnonymous
          ? generateAnonymousName(userSysId, sectionId)
          : row._display_name;

        return {
          post_id: row.post_id,
          post_content_id: row.post_content_id,
          title: row.title,
          content: row.content,
          post_type: row.post_type,
          is_anonymous: isAnonymous,
          created_at: row.created_at,
          user: isAnonymous ? {
            user_sys_id: userSysId,
            email: null,
            profile_pic: null,
            display_name: displayName,
            role_name: null,
          } : {
            user_sys_id: userSysId,
            email: row.email,
            profile_pic: row.profile_pic,
            display_name: row._display_name,
            role_name: row.role_name,
          },
          attachments: row.attachments || [],
        };
      });
    } catch (error) {
      console.error('Error searching posts:', error);
      throw new InternalServerErrorException('Error searching posts');
    }
  }
}
