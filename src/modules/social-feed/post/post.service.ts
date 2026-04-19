// post.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PostContent } from './entities/post-content.entity';
import { PostInClass } from './entities/post-in-class.entity';
import { PostAttachment } from './entities/post-attachment.entity';
import {
  CreatePostDto,
  UpdatePostDto,
  GetPostsInClassDto,
  SearchPostDto,
  SearchPostMasterDto,
  DownloadAttachmentDto,
} from './dto/post.dto';
import { generateAnonymousName } from '../../../common/utils/anonymous.util';
import { BaseResponse } from '../../../common/utils/baseResponse';
import { AppLogger } from '../../../common/logger/app-logger.service';
import { BullMQService } from 'src/common/bullmq/bullmq.service';
import { JobType, NOTIFICATION_QUEUE } from 'src/worker/worker.constants';
@Injectable()
export class PostService {
  constructor(
    @InjectRepository(PostContent)
    private readonly postContentRepo: Repository<PostContent>,

    @InjectRepository(PostInClass)
    private readonly postInClassRepo: Repository<PostInClass>,

       @InjectRepository(PostAttachment)
    private postAttachmentRepo: Repository<PostAttachment>,
    private readonly bullmq: BullMQService,
    private dataSource: DataSource,
    private readonly logger: AppLogger,
  ) { }

  private sanitizeFileName(name: string): string {
    const cleaned = (name || 'attachment')
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'attachment';
  }

  async downloadAttachment(dto: DownloadAttachmentDto): Promise<{
    data: Buffer;
    contentType: string;
    contentLength?: string;
    fileName: string;
  }> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(dto.url);
    } catch {
      throw new BadRequestException('Invalid attachment URL');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('Invalid attachment URL protocol');
    }

    const configuredHost =
      process.env.SOCIAL_FEED_ATTACHMENT_HOST ||
      'linklianstorage.blob.core.windows.net';
    const trustedOrigin = new URL(`https://${configuredHost}`);
    const allowedHost = trustedOrigin.hostname.toLowerCase();

    const configuredPrefix =
      process.env.SOCIAL_FEED_ATTACHMENT_PATH_PREFIX ||
      '/social-feed/fileattachment/';
    const allowedPrefix =
      '/' + configuredPrefix.split('/').filter(Boolean).join('/') + '/';

    if (parsedUrl.hostname.toLowerCase() !== allowedHost) {
      throw new BadRequestException('Attachment host is not allowed');
    }

    let decodedPath = '';
    try {
      decodedPath = decodeURIComponent(parsedUrl.pathname);
    } catch {
      throw new BadRequestException('Invalid attachment path');
    }

    if (decodedPath.includes('\\')) {
      throw new BadRequestException('Attachment path is not allowed');
    }

    const normalizedPath = '/' + decodedPath.split('/').filter(Boolean).join('/');
    if (!normalizedPath.startsWith(allowedPrefix)) {
      throw new BadRequestException('Attachment path is not allowed');
    }

    const relativePath = normalizedPath.slice(allowedPrefix.length);
    if (!relativePath) {
      throw new BadRequestException('Attachment path is not allowed');
    }

    const pathSegments = relativePath.split('/').filter(Boolean);
    if (
      pathSegments.some(
        (segment) =>
          segment === '.' ||
          segment === '..' ||
          /[\u0000-\u001F\u007F]/.test(segment),
      )
    ) {
      throw new BadRequestException('Attachment path is not allowed');
    }

    const encodedRelativePath = pathSegments
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const safeUrl = new URL(
      `${allowedPrefix}${encodedRelativePath}`,
      trustedOrigin,
    ).toString();

    try {
      const upstream = await fetch(safeUrl, { method: 'GET' });
      if (!upstream.ok) {
        this.logger.warn(
          `Attachment upstream failed with status ${upstream.status}`,
          'DownloadAttachment',
          { url: safeUrl },
        );
        throw new BadRequestException('Cannot fetch attachment file');
      }

      const data = Buffer.from(await upstream.arrayBuffer());
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const contentLength = upstream.headers.get('content-length') || undefined;
      const pathName = decodeURIComponent(pathSegments[pathSegments.length - 1] || '').trim();
      const fileName = this.sanitizeFileName(dto.filename?.trim() || pathName || 'attachment');

      return { data, contentType, contentLength, fileName };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('DownloadAttachment failed', 'DownloadAttachment', error);
      throw new InternalServerErrorException('Download attachment failed');
    }
  }

  /**
   * Check if user is in section (authorization)
   * - Student: check enrollment table
   * - Teacher: check section_educator table
   */
  async checkUserInSection(
    userId: number,
    sectionId: number,
    role: string,
  ): Promise<boolean> {
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
  async getPostsInClass(dto: GetPostsInClassDto): Promise<BaseResponse<any[]>> {
    this.logger.log(
      `Fetching posts`, 'GetPostsInClass', {
        section_id: dto.section_id,
        type: dto.type,
      }
    );

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
        TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS _display_name,
        r.role_name          AS _role_name,

        -- Assignment fields
        a.due_date           AS due_date,
        a.max_score          AS max_score,
        a.is_group           AS is_group,

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

      LEFT JOIN user_sys u
        ON pc.user_sys_id = u.user_sys_id

      LEFT JOIN role r
        ON u.role_id = r.role_id
       AND r.flag_valid = true

      LEFT JOIN post_attachment pa
        ON pc.post_content_id = pa.post_content_id

      LEFT JOIN assignment a
        ON a.post_id = pic.post_id
       AND a.flag_valid = true

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
        r.role_name,
        a.due_date,
        a.max_score,
        a.is_group

      ORDER BY pc.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    // Add limit and offset to values
    values.push(dto.limit || 10);
    values.push(dto.offset || 0);

    try {
      const result = await this.dataSource.query(query, values);

      this.logger.log(
        `Query returned ${result.length} posts`,
        'GetPostsInClass',
      );

      // Log first post's attachments for debugging
      if (result.length > 0 && result[0].attachments) {
        this.logger.log(
          'First post attachments sample:',
          'GetPostsInClass',
          result[0].attachments,
        );
      }

      // Transform result to handle anonymous posts and deleted-user posts
      const sanitizedRows = result.filter((row: any) => {
        const postId = Number(row?.post_id);
        const postContentId = Number(row?.post_content_id);
        // user_sys_id may be null when the user account has been deleted — that is valid
        const isValid =
          Number.isFinite(postId) &&
          postId > 0 &&
          Number.isFinite(postContentId) &&
          postContentId > 0;

        if (!isValid) {
          this.logger.warn(
            `Skipping invalid post row in GetPostsInClass`,
            'GetPostsInClass',
            {
              post_id: row?.post_id,
              post_content_id: row?.post_content_id,
              user_sys_id: row?._user_sys_id,
            },
          );
        }

        return isValid;
      });

      const posts = sanitizedRows.map((row: any) => {
        const isAnonymous = row.is_anonymous;
        const rawUserSysId = row._user_sys_id;
        const isUserDeleted = rawUserSysId == null;
        const userSysId = isUserDeleted ? null : Number(rawUserSysId);
        const sectionId = dto.section_id;

        const displayName = isUserDeleted
          ? 'ไม่มีบัญชีผู้ใช้งาน'
          : isAnonymous
            ? generateAnonymousName(userSysId as number, sectionId)
            : row._display_name;

        return {
          post_id: row.post_id,
          post_content_id: row.post_content_id,
          title: row.title,
          content: row.content,
          post_type: row.post_type,
          is_anonymous: isAnonymous,
          is_user_deleted: isUserDeleted,
          created_at: row.created_at,
          due_date: row.due_date || null,
          max_score: row.max_score ? Number(row.max_score) : null,
          is_group: row.is_group ?? null,
          user: {
            user_sys_id: userSysId,
            email: isAnonymous || isUserDeleted ? null : row._email,
            profile_pic: isAnonymous || isUserDeleted ? null : row._profile_pic,
            display_name: displayName,
            role_name: isAnonymous || isUserDeleted ? null : row._role_name,
          },
          attachments: row.attachments || [],
        };
      });
      this.logger.log(
        `Transformed posts sample:`,
        'GetPostsInClass',
        posts.length > 0 ? posts[0] : 'No posts',
      );

      return {
        success: true,
        message: 'Posts retrieved successfully',
        data: posts,
      };
    } catch (error : any) {
      this.logger.error('Error getting posts in class', 'GetPostInClass', error);
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
    let announcementSummaryJobData: {
      post_content_id: string;
      title: string;
      content: string;
      file: {
        attachment_id: string;
        file_url: string;
        file_type: string;
        original_name: string | null;
      }[];
      file_count: number;
    } | null = null;

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
        this.logger.log(
          `Validating ${dto.attachments.length} attachments strictly`,
          'CreatePost',
        );

        const invalidAttachments = dto.attachments.filter(
          (f) => !f.file_url || !f.file_type,
        );

        if (invalidAttachments.length > 0) {
          this.logger.error(
            `Found ${invalidAttachments.length} invalid attachments`,
            'CreatePost',
          );
          throw new BadRequestException(
            `มีไฟล์แนบ ${invalidAttachments.length} ไฟล์ที่ไม่สมบูรณ์ กรุณาลองอัปโหลดใหม่อีกครั้ง`,
          );
        }

        // Check for duplicate URLs
        const urls = dto.attachments.map((a) => a.file_url);
        const uniqueUrls = new Set(urls);
        if (urls.length !== uniqueUrls.size) {
          this.logger.error('Found duplicate file URLs', 'CreatePost');
          throw new BadRequestException('พบไฟล์ซ้ำ กรุณาตรวจสอบไฟล์แนบ');
        }

        this.logger.log(
          `All ${dto.attachments.length} attachments are valid`,
          'CreatePost',
        );
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
        this.logger.log(
          `Processing ${dto.attachments.length} attachments (strict mode)`,
          'CreatePost',
        );

        for (const attachment of dto.attachments) {
          this.logger.log('Attachment data:', 'CreatePost', {
            file_url: attachment.file_url,
            file_type: attachment.file_type,
            original_name: attachment.original_name,
          });

          const attachmentQuery = `
            INSERT INTO post_attachment
              (post_content_id, file_url, file_type, original_name)
            VALUES ($1, $2, $3, $4)
            RETURNING attachment_id, file_url, file_type, original_name
          `;

          this.logger.log('Inserting attachment with params:', 'CreatePost', {
            post_content_id: postContent.post_content_id,
            file_url: attachment.file_url,
            file_type: attachment.file_type,
            original_name: attachment.original_name || null,
          });

          const attachmentResult = await queryRunner.query(attachmentQuery, [
            postContent.post_content_id,
            attachment.file_url,
            attachment.file_type,
            attachment.original_name || null,
          ]);

          this.logger.log(
            'Attachment inserted successfully:',
            'CreatePost',
            attachmentResult[0],
          );
          attachments.push(attachmentResult[0]);
        }

        this.logger.log(
          `All ${attachments.length} attachments inserted successfully`,
          'CreatePost',
        );
      } else {
        this.logger.log('No attachments to process', 'CreatePost');
      }

      // 3.5 Handle AI summary generation for announcement posts
      if (dto.post_type === 'announcement') {
        const pdfFiles = attachments.filter((attachment) => {
          const fileType = String(attachment.file_type || '').toLowerCase();
          return fileType === 'pdf' || fileType.includes('pdf');
        });

        if (pdfFiles.length > 0) {
          announcementSummaryJobData = {
            post_content_id: String(postContent.post_content_id),
            title: postContent.title ?? '',
            content: postContent.content ?? '',
            file: pdfFiles.map((attachment) => ({
              attachment_id: String(attachment.attachment_id),
              file_url: attachment.file_url,
              file_type: String(attachment.file_type).toLowerCase(),
              original_name: attachment.original_name ?? null,
            })),
            file_count: pdfFiles.length,
          };
        } else {
          this.logger.log(
            'Announcement post has no PDF attachment, skipping AI summary queue',
            'CreatePost',
            {
              post_content_id: postContent.post_content_id,
              attachment_count: attachments.length,
            },
          );
        }
      }

      // 4. Handle assignment-specific logic if post_type is 'assignment'
      const assignmentIds: number[] = [];
      const createdGroups: any[] = [];

      if (dto.post_type === 'assignment') {
        this.logger.log('Processing assignment creation', 'CreatePost');

        // Validate assignment fields
        if (!dto.due_date) {
          throw new BadRequestException('due_date is required for assignments');
        }

        if (dto.is_group === undefined || dto.is_group === null) {
          throw new BadRequestException('is_group is required for assignments');
        }

        // Create assignment records for each post_id
        for (const postId of postIds) {
          const assignmentQuery = `
            INSERT INTO assignment
              (post_id, due_date, max_score, is_group, flag_valid)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING assignment_id, post_id, due_date, max_score, is_group, flag_valid
          `;

          const assignmentResult = await queryRunner.query(assignmentQuery, [
            postId,
            dto.due_date,
            dto.max_score || null,
            dto.is_group,
            true, // Set flag_valid = true
          ]);

          const assignment = assignmentResult[0];
          assignmentIds.push(assignment.assignment_id);

          this.logger.log('Assignment created:', 'CreatePost', assignment);

          // Handle group creation based on is_group flag
          if (!dto.is_group) {
            // ===== งานเดี่ยว: สร้าง student_group + group_member ให้นักเรียนทุกคนใน section =====
            this.logger.log(
              'Individual assignment - auto-creating groups for all enrolled students',
              'CreatePost',
            );

            // Find the section_id for this post_id
            const sectionForPost = sectionIds[postIds.indexOf(postId)];

            // Get all enrolled students in this section
            // กรองเฉพาะ Active เพื่อข้าม Inactive และ student_id IS NOT NULL เพื่อข้าม deleted users
            const enrolledStudents = await queryRunner.query(
              `
              SELECT e.student_id
              FROM enrollment e
              JOIN user_sys u ON e.student_id = u.user_sys_id AND u.flag_valid = true AND u.user_status = 'Active'
              WHERE e.section_id = $1
                AND e.flag_valid = true
                AND e.student_id IS NOT NULL
            `,
              [sectionForPost],
            );

            this.logger.log(
              `Found ${enrolledStudents.length} enrolled students in section ${sectionForPost}`,
              'CreatePost',
            );

            // Create 1 student_group per student (งานเดี่ยว = 1 คน 1 กลุ่ม)
            for (const student of enrolledStudents) {
              const studentId = student.student_id;

              // Create student_group
              const groupResult = await queryRunner.query(
                `
                INSERT INTO student_group
                  (assignment_id, group_name,flag_valid)
                VALUES ($1, $2,$3)
                RETURNING group_id, assignment_id, group_name
              `,
                [
                  assignment.assignment_id,
                  `individual_student_${studentId}`,
                  true,
                ],
              );

              const createdGroup = groupResult[0];

              // Create group_member
              await queryRunner.query(
                `
                INSERT INTO group_member
                  (group_id, user_sys_id,flag_valid)
                VALUES ($1, $2,$3)
              `,
                [createdGroup.group_id, studentId, true],
              );

              createdGroups.push({
                group_id: createdGroup.group_id,
                group_name: createdGroup.group_name,
                member_ids: [studentId],
              });
            }

            this.logger.log(
              `Created ${enrolledStudents.length} individual groups`,
              'CreatePost',
            );
          } else {
            // ===== งานกลุ่ม: ไม่สร้าง group ตอนนี้ นักเรียนจะมาสร้างเองทีหลัง =====
            this.logger.log(
              'Group assignment - students will create groups later',
              'CreatePost',
            );
          }
        }

        this.logger.log('Assignment processing completed', 'CreatePost');
      }

      await queryRunner.commitTransaction();

      this.bullmq.addJob({
        queue: NOTIFICATION_QUEUE,
        job: JobType.SOCIAL_FEED_POST_CREATED,
        data: {
          type: JobType.SOCIAL_FEED_POST_CREATED,
          actor_id: userId,
          post_content_id: postContent.post_content_id,
          post_type: postContent.post_type,
          title: postContent.title ?? '',
          section_ids: sectionIds,
        },
      });

      if (announcementSummaryJobData) {
        await this.bullmq.addJob({
          queue: 'ai_summary_queue',
          job: 'post-summary',
          data: announcementSummaryJobData,
        });

        this.logger.log('Announcement summary job queued', 'CreatePost', {
          post_content_id: announcementSummaryJobData.post_content_id,
          file_count: announcementSummaryJobData.file_count,
        });
      }

      const responseData = {
        post_ids: postIds,
        post_content_id: postContent.post_content_id,
        title: postContent.title,
        content: postContent.content,
        post_type: postContent.post_type,
        is_anonymous: postContent.is_anonymous,
        created_at: postContent.created_at,
        section_ids: sectionIds,
        attachments,
        ...(dto.post_type === 'assignment' && {
          assignment: {
            assignment_ids: assignmentIds,
            due_date: dto.due_date,
            max_score: dto.max_score,
            is_group: dto.is_group,
            groups: createdGroups.length > 0 ? createdGroups : undefined,
          },
        }),
        warnings: warnings.length > 0 ? warnings : null,
      };

      this.logger.log(
        `Post created successfully with data:`,
        'CreatePost',
        responseData,
      );

      return {
        success: true,
        message: 'Post created successfully',
        data: responseData,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error creating post:', 'CreatePost', error);
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
  async findPostOwner(
    postId: number,
  ): Promise<{ post_content_id: number; user_sys_id: number }> {
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

    const responseData = {
      post_content_id: owner.post_content_id,
      user_sys_id: owner.user_sys_id,
    };

    this.logger.log(
      `Found owner for post_id ${postId}:`,
      'FindPostOwner',
      responseData,
    );

    return responseData;
  }

  /**
   * Update post content (only owner can update)
   * Accepts either postId (post_in_class.post_id) or post_content_id
   * Also handles attachment updates (add/remove)
   */
  async updatePost(
    userId: number,
    postId: number,
    dto: UpdatePostDto,
    postContentId?: number,
  ) {
    try {
      let targetPostContentId: number;
      let ownerUserId: number;

      this.logger.log(
        `userId=${userId}, postId=${postId}, postContentId=${postContentId}`,
        'UpdatePost',
      );

      // If postContentId is provided directly, use it
      if (postContentId && postContentId > 0) {
        const ownerQuery = `
          SELECT user_sys_id, post_content_id
          FROM post_content
          WHERE post_content_id = $1 AND flag_valid = true
        `;
        const result = await this.dataSource.query(ownerQuery, [postContentId]);
        this.logger.log('Query result:', 'UpdatePost', result);

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

      this.logger.log(`update post detail`, 'UpdatePost', {
        targetPostContentId,
        ownerUserId,
        requesterId: userId,
      });

      // Check ownership
      if (ownerUserId !== userId) {
        this.logger.log(`Permission denied`, 'UpdatePost', {
          ownerUserId,
          requesterId: userId,
        });
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
        this.logger.log(
          `Updating attachments: ${dto.attachments.length} files`,
          'UpdatePost',
        );

        try {
          // Soft delete existing attachments
          this.logger.log(
            `Soft deleting existing attachments for post_content_id: ${targetPostContentId}`,
            'UpdatePost',
          );
          await this.dataSource.query(
            `
            UPDATE post_attachment
            SET flag_valid = false
            WHERE post_content_id = $1 AND flag_valid = true
          `,
            [targetPostContentId],
          );

          // Insert new attachments
          if (dto.attachments.length > 0) {
            for (const attachment of dto.attachments) {
              this.logger.log('Processing attachment:', 'UpdatePost', {
                file_url: attachment.file_url,
                file_type: attachment.file_type,
                original_name: attachment.original_name,
              });

              if (!attachment.file_url || !attachment.file_type) {
                this.logger.log(
                  'Skipping invalid attachment:',
                  'UpdatePost',
                  attachment,
                );
                continue;
              }

              this.logger.log(
                `Inserting attachment with original_name: ${attachment.original_name || 'NULL'}`,
                'UpdatePost',
              );
              const result = await this.dataSource.query(
                `
                INSERT INTO post_attachment (post_content_id, file_url, file_type, original_name)
                VALUES ($1, $2, $3, $4)
                RETURNING attachment_id, file_url, file_type, original_name
              `,
                [
                  targetPostContentId,
                  attachment.file_url,
                  attachment.file_type,
                  attachment.original_name || null,
                ],
              );

              this.logger.log('Attachment inserted:', 'UpdatePost', result[0]);
            }
          }

          this.logger.log('Attachments updated successfully', 'UpdatePost');
        } catch (attachmentError) {
          this.logger.error(
            `Error updating attachments:`,
            'UpdatePost',
            attachmentError,
          );
        }
      }

      // Handle assignment field updates (due_date, max_score, is_group)
      if (
        dto.due_date !== undefined ||
        dto.max_score !== undefined ||
        dto.is_group !== undefined
      ) {
        this.logger.log(`Updating assignment fields`, 'UpdatePost', {
          due_date: dto.due_date,
          max_score: dto.max_score,
          is_group: dto.is_group,
        });

        const setClauses: string[] = [];
        const assignmentValues: any[] = [];
        let aIdx = 1;

        if (dto.due_date !== undefined) {
          setClauses.push(`due_date = $${aIdx++}`);
          assignmentValues.push(dto.due_date);
        }
        if (dto.max_score !== undefined) {
          setClauses.push(`max_score = $${aIdx++}`);
          assignmentValues.push(dto.max_score);
        }
        if (dto.is_group !== undefined) {
          setClauses.push(`is_group = $${aIdx++}`);
          assignmentValues.push(dto.is_group);
        }

        if (setClauses.length > 0) {
          // Resolve assignment rows for this post_content.
          const assignmentRows: Array<{
            assignment_id: number;
            is_group: boolean;
            section_id: number;
          }> = await this.dataSource.query(
            `
              SELECT
                a.assignment_id::int AS assignment_id,
                a.is_group AS is_group,
                pic.section_id::int AS section_id
              FROM assignment a
              JOIN post_in_class pic
                ON a.post_id = pic.post_id
               AND pic.flag_valid = true
              WHERE pic.post_content_id = $1
                AND a.flag_valid = true
            `,
            [targetPostContentId],
          );

          const assignmentIds = assignmentRows.map((r) => r.assignment_id);
          // ใช้ Boolean() เพื่อให้ comparison ถูกต้องไม่ว่า PostgreSQL จะ return ค่าเป็น boolean หรือ string
          const isChangingType =
            dto.is_group !== undefined &&
            assignmentRows.some(
              (r) => Boolean(r.is_group) !== Boolean(dto.is_group),
            );

          this.logger.log('Assignment type change check', 'UpdatePost', {
            isChangingType,
            dto_is_group: dto.is_group,
            current_is_group: assignmentRows.map((r) => r.is_group),
          });

          if (assignmentIds.length > 0 && isChangingType) {
            // Business rule: once there is a submission, assignment type cannot be changed.
            const submissionCountRows: Array<{ total: string }> =
              await this.dataSource.query(
                `
                  SELECT COUNT(*)::int AS total
                  FROM submission
                  WHERE assignment_id = ANY($1)
                    AND flag_valid = true
                `,
                [assignmentIds],
              );

            const totalSubmissions =
              Number(submissionCountRows[0]?.total ?? 0) || 0;
            if (totalSubmissions > 0) {
              throw new BadRequestException(
                'ไม่สามารถเปลี่ยนประเภทงานได้ เนื่องจากมีนักเรียนส่งงานแล้ว',
              );
            }

            // Clear all old groups/members before rebuilding type-specific groups.
            // ทำงานทั้งสองทิศทาง: group→individual และ individual→group
            await this.dataSource.query(
              `
                DELETE FROM group_member
                WHERE group_id IN (
                  SELECT group_id FROM student_group
                  WHERE assignment_id = ANY($1)
                )
              `,
              [assignmentIds],
            );
            await this.dataSource.query(
              `
                DELETE FROM student_group
                WHERE assignment_id = ANY($1)
              `,
              [assignmentIds],
            );

            this.logger.log(
              'Cleared all existing groups before type switch',
              'UpdatePost',
              { assignmentIds, switching_to: dto.is_group ? 'group' : 'individual' },
            );

            // Switching to individual assignment => recreate one-person groups.
            // individual→group: ไม่สร้างอะไร นักเรียนสร้างกลุ่มเอง
            if (dto.is_group === false) {
              for (const row of assignmentRows) {
                // กรองเฉพาะ Active และ student_id IS NOT NULL เพื่อข้าม Inactive / deleted users
                const enrolledStudents: Array<{ student_id: number }> =
                  await this.dataSource.query(
                    `
                      SELECT e.student_id::int AS student_id
                      FROM enrollment e
                      JOIN user_sys u ON e.student_id = u.user_sys_id AND u.flag_valid = true AND u.user_status = 'Active'
                      WHERE e.section_id = $1
                        AND e.flag_valid = true
                        AND e.student_id IS NOT NULL
                    `,
                    [row.section_id],
                  );

                for (const student of enrolledStudents) {
                  const groupRes: Array<{ group_id: number }> =
                    await this.dataSource.query(
                      `
                        INSERT INTO student_group (assignment_id, group_name, flag_valid)
                        VALUES ($1, $2, true)
                        RETURNING group_id::int AS group_id
                      `,
                      [
                        row.assignment_id,
                        `individual_student_${student.student_id}`,
                      ],
                    );
                  const groupId = Number(groupRes[0]?.group_id);
                  if (!groupId) continue;

                  await this.dataSource.query(
                    `
                      INSERT INTO group_member (group_id, user_sys_id, flag_valid)
                      VALUES ($1, $2, true)
                    `,
                    [groupId, student.student_id],
                  );
                }
              }
            }
          }

          assignmentValues.push(targetPostContentId);
          const assignmentQuery = `
            UPDATE assignment a
            SET ${setClauses.join(', ')}
            FROM post_in_class pic
            WHERE pic.post_content_id = $${aIdx}
              AND a.post_id = pic.post_id
              AND a.flag_valid = true
          `;

          await this.dataSource.query(assignmentQuery, assignmentValues);
          this.logger.log(
            'Assignment fields updated successfully',
            'UpdatePost',
          );
        }
      }

      const postContentData = result[0];

      this.bullmq.addJob({
        queue: NOTIFICATION_QUEUE,
        job: JobType.SOCIAL_FEED_POST_UPDATED,
        data: {
          type: JobType.SOCIAL_FEED_POST_UPDATED,
          actor_id: userId,
          post_content_id: targetPostContentId,
          post_type: postContentData?.post_type ?? '',
          title: postContentData?.title ?? '',
          section_ids: dto.section_id ? [dto.section_id] : [],
        },
      });

      return {
        success: true,
        message: 'Post updated successfully',
        data: result[0],
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Error updating post:', 'UpdatePost', error);
      throw new InternalServerErrorException('Error updating post');
    }
  }

  /**
   * Update post attachments (add new, remove deleted)
   */
  async updatePostAttachments(
    userId: number,
    postContentId: number,
    attachmentsToAdd: {
      file_url: string;
      file_type: string;
      original_name?: string;
    }[],
    attachmentIdsToRemove: number[],
  ) {
    // Check ownership first
    const ownerQuery = `
      SELECT user_sys_id FROM post_content
      WHERE post_content_id = $1 AND flag_valid = true
    `;
    const ownerResult = await this.dataSource.query(ownerQuery, [
      postContentId,
    ]);

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
        await queryRunner.query(
          `
          UPDATE post_attachment
          SET flag_valid = false
          WHERE attachment_id = ANY($1)
            AND post_content_id = $2
        `,
          [attachmentIdsToRemove, postContentId],
        );
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
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Hard delete post and its related data (only owner can delete)
   * Supports both post_id and post_content_id
   * Deletes: assignment -> comments -> post_attachment -> post_in_class -> post_content
   */
  async deletePost(userId: number, postId: number, postContentId?: number) {
    try {
      let targetPostContentId: number;
      let ownerUserId: number;
      let targetPostIds: number[] = [];

      this.logger.log(`delete post detail`, 'DeletePost', {
        userId,
        postId,
        postContentId,
      });

      // If postContentId is provided, find owner by post_content_id
      if (postContentId && postContentId > 0) {
        const ownerQuery = `
          SELECT pc.user_sys_id, pc.post_content_id
          FROM post_content pc
          WHERE pc.post_content_id = $1
        `;
        const result = await this.dataSource.query(ownerQuery, [postContentId]);

        if (!result.length) {
          throw new NotFoundException('Post not found');
        }
        targetPostContentId = postContentId;
        ownerUserId = Number(result[0].user_sys_id);

        // Get all post_ids associated with this post_content_id
        const postIdsQuery = `
          SELECT post_id FROM post_in_class WHERE post_content_id = $1
        `;
        const postIdsResult = await this.dataSource.query(postIdsQuery, [
          postContentId,
        ]);
        targetPostIds = postIdsResult.map((row: any) => row.post_id);
      } else if (postId && postId > 0) {
        // Check ownership by postId
        const ownerQuery = `
          SELECT pc.user_sys_id, pc.post_content_id
          FROM post_in_class pic
          JOIN post_content pc ON pic.post_content_id = pc.post_content_id
          WHERE pic.post_id = $1
        `;
        const result = await this.dataSource.query(ownerQuery, [postId]);

        if (!result.length) {
          throw new NotFoundException('Post not found');
        }

        targetPostContentId = result[0].post_content_id;
        ownerUserId = Number(result[0].user_sys_id);
        targetPostIds = [postId];

        // Get all other post_ids with same post_content_id
        const allPostIdsQuery = `
          SELECT post_id FROM post_in_class WHERE post_content_id = $1
        `;
        const allPostIdsResult = await this.dataSource.query(allPostIdsQuery, [
          targetPostContentId,
        ]);
        targetPostIds = allPostIdsResult.map((row: any) => row.post_id);
      } else {
        throw new BadRequestException('post_id or post_content_id is required');
      }

      this.logger.log(`delete post detail`, 'DeletePost', {
        targetPostIds,
        ownerUserId,
        requesterId: userId,
      });

      // Check ownership
      if (ownerUserId !== userId) {
        this.logger.log(`Permission denied`, 'DeletePost', {
          owner: ownerUserId,
          requester: userId,
        });
        throw new ForbiddenException('You are not allowed to delete this post');
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 1. Get all assignment_ids for these post_ids
        let assignmentIds: number[] = [];
        if (targetPostIds.length > 0) {
          const assignmentIdsQuery = `
            SELECT assignment_id FROM assignment WHERE post_id = ANY($1)
          `;
          const assignmentIdsResult = await queryRunner.query(
            assignmentIdsQuery,
            [targetPostIds],
          );
          assignmentIds = assignmentIdsResult.map(
            (row: any) => row.assignment_id,
          );
          this.logger.log(
            `Found assignment_ids: ${assignmentIds}`,
            'DeletePost',
          );
        }

        // 2. Delete group_member for all groups in these assignments
        if (assignmentIds.length > 0) {
          await queryRunner.query(
            `
            DELETE FROM group_member
            WHERE group_id IN (
              SELECT group_id FROM student_group WHERE assignment_id = ANY($1)
            )
          `,
            [assignmentIds],
          );
          this.logger.log(
            `Deleted group_member records for assignment_ids: ${assignmentIds}`,
            'DeletePost',
          );
        }

        // 3. Delete student_group for these assignments
        if (assignmentIds.length > 0) {
          await queryRunner.query(
            `
            DELETE FROM student_group
            WHERE assignment_id = ANY($1)
          `,
            [assignmentIds],
          );
          this.logger.log(
            `Deleted student_group records for assignment_ids: ${assignmentIds}`,
            'DeletePost',
          );
        }

        // 4. Delete assignments
        if (targetPostIds.length > 0) {
          await queryRunner.query(
            `
            DELETE FROM assignment
            WHERE post_id = ANY($1)
          `,
            [targetPostIds],
          );
          this.logger.log(
            `Deleted assignments for post_ids: ${targetPostIds}`,
            'DeletePost',
          );
        }

        // 5. Delete comment closure paths for comments in these posts
        if (targetPostIds.length > 0) {
          await queryRunner.query(
            `
            DELETE FROM post_comment_path
            WHERE ancestor_id IN (
              SELECT comment_id FROM post_comment WHERE post_id = ANY($1)
            )
            OR descendant_id IN (
              SELECT comment_id FROM post_comment WHERE post_id = ANY($1)
            )
          `,
            [targetPostIds],
          );
          this.logger.debug(
            `[DeletePost] Deleted post_comment_path records for post_ids: ${targetPostIds}`,
            'DeletePost',
          );
        }

        // 6. Delete comments that reference these post_ids
        if (targetPostIds.length > 0) {
          await queryRunner.query(
            `
            DELETE FROM post_comment
            WHERE post_id = ANY($1)
          `,
            [targetPostIds],
          );
          this.logger.debug(
            `[DeletePost] Deleted post_comment records for post_ids: ${targetPostIds}`,
            'DeletePost',
          );
        }

        // 7. Delete bookmarks that reference these post_ids
        if (targetPostIds.length > 0) {
          await queryRunner.query(
            `
            DELETE FROM bookmark
            WHERE post_id = ANY($1)
          `,
            [targetPostIds],
          );
          this.logger.debug(
            `[DeletePost] Deleted bookmark records for post_ids: ${targetPostIds}`,
            'DeletePost',
          );
        }

        // 8. Delete attachments
        await queryRunner.query(
          `
          DELETE FROM post_attachment
          WHERE post_content_id = $1
        `,
          [targetPostContentId],
        );
        this.logger.log(
          `Deleted attachments for post_content_id: ${targetPostContentId}`,
          'DeletePost',
        );

        // 9. Delete all post_in_class records
        await queryRunner.query(
          `
          DELETE FROM post_in_class
          WHERE post_content_id = $1
        `,
          [targetPostContentId],
        );
        this.logger.log(
          `Deleted post_in_class records for post_content_id: ${targetPostContentId}`,
          'DeletePost',
        );

        // 10. Delete post_content
        await queryRunner.query(
          `
          DELETE FROM post_content
          WHERE post_content_id = $1
        `,
          [targetPostContentId],
        );
        this.logger.log(
          `Deleted post_content: ${targetPostContentId}`,
          'DeletePost',
        );

        await queryRunner.commitTransaction();

        this.logger.log('Post hard deleted successfully', 'DeletePost');

        return {
          success: true,
          message: 'Post deleted successfully',
          data: {
            post_id: postId,
            post_content_id: targetPostContentId,
            deleted_post_ids: targetPostIds,
          },
        };
      } catch (error) {
        await queryRunner.rollbackTransaction();
        if (
          error instanceof NotFoundException ||
          error instanceof ForbiddenException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
        throw error;
      } finally {
        await queryRunner.release();
      }
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Error deleting post:', 'DeletePost', error);
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
        a.due_date,
a.max_score,
a.is_group,
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
      LEFT JOIN assignment a
  ON a.post_id = p.post_id
 AND a.flag_valid = true
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
      const final_result = result.map((row: any) => {
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
          due_date: row.due_date || null,
          max_score: row.max_score ? Number(row.max_score) : null,
          is_group: row.is_group ?? null,

          user: isAnonymous
            ? {
              user_sys_id: userSysId,
              email: null,
              profile_pic: null,
              display_name: displayName,
              role_name: null,
            }
            : {
              user_sys_id: userSysId,
              email: row.email,
              profile_pic: row.profile_pic,
              display_name: row._display_name,
              role_name: row.role_name,
            },
          attachments: row.attachments || [],
        };
      });
      this.logger.log(
        'Search results transformed:',
        'SearchPosts',
        final_result.length > 0 ? final_result[0] : 'No posts',
      );
      return {
        success: true,
        message: 'Posts retrieved successfully',
        data: final_result,
      };
    } catch (error) {
      this.logger.error('Error searching posts:', 'SearchPosts', error);
      throw new InternalServerErrorException('Error searching posts');
    }
  }

  async getPostById(postId: number) {
    const safePostId = Number(postId);
    if (!Number.isFinite(safePostId) || safePostId <= 0) {
      this.logger.warn(
        `Invalid postId received in getPostById`,
        'GetPostById',
        { postId },
      );
      throw new BadRequestException('invalid post_id');
    }

    const query = `
    SELECT
      pic.post_id,
      pic.section_id,
      pc.post_content_id,
      pc.title,
      pc.content,
      pc.post_type,
      pc.is_anonymous,
      pc.created_at,

      u.user_sys_id        AS _user_sys_id,
      u.email              AS _email,
      u.profile_pic        AS _profile_pic,
      TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) AS _display_name,
      r.role_name          AS _role_name,

      a.due_date,
      a.max_score,
      a.is_group,

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
    LEFT JOIN user_sys u
      ON pc.user_sys_id = u.user_sys_id
    LEFT JOIN role r
      ON u.role_id = r.role_id
    LEFT JOIN post_attachment pa
      ON pc.post_content_id = pa.post_content_id
    LEFT JOIN assignment a
      ON a.post_id = pic.post_id
     AND a.flag_valid = true

    WHERE pic.post_id = $1
      AND pic.flag_valid = true
      AND pc.flag_valid = true

    GROUP BY
      pic.post_id,
      pic.section_id,
      pc.post_content_id,
      u.user_sys_id,
      r.role_name,
      a.due_date,
      a.max_score,
      a.is_group
  `;

    const result = await this.dataSource.query(query, [safePostId]);

    if (!result.length) {
      throw new NotFoundException('Post not found');
    }

    const row = result[0];

    const isAnonymous = row.is_anonymous;
    const rawUserSysId = row._user_sys_id;
    const isUserDeleted = rawUserSysId == null;
    const userSysId = isUserDeleted ? null : Number(rawUserSysId);
    const sectionId = row.section_id;

    const displayName = isUserDeleted
      ? 'ไม่มีบัญชีผู้ใช้งาน'
      : isAnonymous
        ? generateAnonymousName(userSysId as number, sectionId)
        : row._display_name;

    const post = {
      post_id: row.post_id,
      post_content_id: row.post_content_id,
      title: row.title,
      content: row.content,
      post_type: row.post_type,
      is_anonymous: isAnonymous,
      is_user_deleted: isUserDeleted,
      created_at: row.created_at,
      due_date: row.due_date || null,
      max_score: row.max_score ? Number(row.max_score) : null,
      is_group: row.is_group ?? null,

      user: {
        user_sys_id: userSysId,
        email: isAnonymous || isUserDeleted ? null : row._email,
        profile_pic: isAnonymous || isUserDeleted ? null : row._profile_pic,
        display_name: displayName,
        role_name: isAnonymous || isUserDeleted ? null : row._role_name,
      },

      attachments: row.attachments || [],
    };

    return {
      success: true,
      message: 'Post retrieved successfully',
      data: post,
    };
  }

  async searchPostMaster(dto: SearchPostMasterDto) {
    const hasInput =
      dto.post_content_id;

    if (!hasInput) {
      throw new BadRequestException('No value input!');
    }

    let query = `
      SELECT * FROM post_content pc
      LEFT JOIN post_attachment pa ON pc.post_content_id = pa.post_content_id AND pa.flag_valid = true
      WHERE 1=1
    `

    const values: any[] = [];
    let index = 1;

    if (dto.post_content_id) {
      query += ` AND pc.post_content_id = $${index++}`;
      values.push(dto.post_content_id);
    }

    try {
      const result = await this.dataSource.query(
        query,
        values,
      );
      return { success: true, data: result };
    } catch (error: unknown) {
      this.logger.error('Error querying sections:', 'SearchPostMaster', error);
      throw new InternalServerErrorException('Internal server error');
    }
  }
}
