import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  GetClassAssignmentsDto,
  CreateGroupDto,
  UpdateGroupDto,
} from './dto/assignment.dto';
import { generateAnonymousName } from '../../common/utils/anonymous.util';
import { AppLogger } from '../../common/logger/app-logger.service';
@Injectable()
export class AssignmentService {
  constructor(
    private readonly logger: AppLogger,
    private dataSource: DataSource,
  ) {}

  async getClassAssignments(userId: number, dto: GetClassAssignmentsDto) {
    const { section_id, role, offset = 0, limit = 10 } = dto;

    const isStudent = role === 'high school student' || role === 'uni student';

    this.logger.log(`get assignment function`, 'GetClassAssignments', {
      section_id,
      role,
      userId,
      offset,
      limit,
    });

    try {
      if (isStudent && userId) {
        return await this.getStudentAssignments(
          section_id,
          userId,
          offset,
          limit,
        );
      } else {
        return await this.getTeacherAssignments(section_id, offset, limit);
      }
    } catch (error: any) {
      this.logger.error(
        'getStudentAssignments error:',
        'GetClassAssignments',
        error,
      );
      throw new InternalServerErrorException('Error fetching assignments');
    }
  }

  private async getStudentAssignments(
    sectionId: number,
    userId: number,
    offset: number,
    limit: number,
  ) {
    const query = `
      SELECT
        a.assignment_id,
        pic.post_id,
        pc.title,
        pc.created_at,  
        sub.name_th AS subject_name_th,
        sub.name_en AS subject_name_en,
        CASE WHEN a.is_group = true THEN 'งานกลุ่ม' ELSE 'งานเดี่ยว' END AS assignment_type,
        a.is_group,
        a.due_date,

        (
          SELECT sb.submitted_at
          FROM submission sb
          JOIN student_group sg ON sb.group_id = sg.group_id
          JOIN group_member gm ON sg.group_id = gm.group_id
          WHERE sb.assignment_id = a.assignment_id
            AND gm.user_sys_id = $2
            AND sb.flag_valid = true
            AND sg.flag_valid = true
            AND gm.flag_valid = true
          ORDER BY sb.submitted_at DESC
          LIMIT 1
        ) AS submitted_at,

        (
          SELECT COUNT(*)::int
          FROM enrollment e
          WHERE e.section_id = $1
            AND e.flag_valid = true
        ) AS total_students,

        (
          SELECT COUNT(*)::int
          FROM submission sb
          WHERE sb.assignment_id = a.assignment_id
            AND sb.flag_valid = true
        ) AS submitted_count,

        -- ดึงข้อมูลครูผู้สอน
        COALESCE(
          (
            SELECT json_agg(
              jsonb_build_object(
                'educator_id', u.user_sys_id,
                'educator_name', CONCAT(u.first_name, ' ', u.last_name),
                'position', se.position
              )
              ORDER BY 
                CASE se.position
                  WHEN 'main' THEN 1
                  WHEN 'co' THEN 2
                  ELSE 3
                END
            )
            FROM section_educator se
            JOIN user_sys u ON se.educator_id = u.user_sys_id
            WHERE se.section_id = s.section_id
              AND se.flag_valid = true
              AND u.flag_valid = true
          ),
          '[]'::json
        ) AS educators

      FROM assignment a
      JOIN post_in_class pic
        ON a.post_id = pic.post_id
       AND pic.flag_valid = true
      JOIN post_content pc
        ON pic.post_content_id = pc.post_content_id
       AND pc.flag_valid = true
      JOIN section s
        ON pic.section_id = s.section_id
      JOIN subject sub
        ON s.subject_id = sub.subject_id

      WHERE pic.section_id = $1
        AND a.flag_valid = true
        AND pc.post_type = 'assignment'

      ORDER BY a.due_date DESC NULLS LAST
LIMIT $3 OFFSET $4
    `;

    const result = await this.dataSource.query(query, [
      sectionId,
      userId,
      limit,
      offset,
    ]);
    const assignmentIds = result.map((row) => row.assignment_id);
    this.logger.debug(`[GetClassAssignments]`, 'Assignment', {
      result_length: result.length,
      assignmentIds,
      section_id: sectionId,
      userId,
      offset,
      limit,
    });

    const final_result = result.map((row: any) => ({
      assignment_id: row.assignment_id,
      post_id: row.post_id,
      title: row.title,
      created_at: row.created_at,
      subject_name_th: row.subject_name_th,
      subject_name_en: row.subject_name_en,
      assignment_type: row.assignment_type,
      due_date: row.due_date,
      submitted_at: row.submitted_at,
      total_students: Number(row.total_students),
      submitted_count: Number(row.submitted_count),
      educators: row.educators || [],
      is_group: row.is_group,
    }));

    return {
      success: true,
      message: 'Assignments retrieved successfully',
      data: final_result,
    };
  }

  private async getTeacherAssignments(
    sectionId: number,
    offset: number,
    limit: number,
  ) {
    const query = `
    SELECT
      a.assignment_id,
      pic.post_id,
      pc.title,
      pc.created_at,
      sub.name_th AS subject_name_th,
      sub.name_en AS subject_name_en,
      CASE WHEN a.is_group = true THEN 'งานกลุ่ม' ELSE 'งานเดี่ยว' END AS assignment_type,
      a.is_group,
      a.due_date,

      (
        SELECT COUNT(*)::int
        FROM enrollment e
        WHERE e.section_id = $1
          AND e.flag_valid = true
      ) AS total_students,

      (
        SELECT COUNT(*)::int
        FROM submission sb
        WHERE sb.assignment_id = a.assignment_id
          AND sb.flag_valid = true
      ) AS submitted_count,

      (
        SELECT COUNT(*)::int
        FROM student_group sg
        WHERE sg.assignment_id = a.assignment_id
          AND sg.flag_valid = true
      ) AS total_groups,

      (
        SELECT COUNT(DISTINCT sg.group_id)::int
        FROM student_group sg
        JOIN submission sb ON sg.group_id = sb.group_id
        WHERE sg.assignment_id = a.assignment_id
          AND sg.flag_valid = true
          AND sb.flag_valid = true
      ) AS submitted_groups,

      COALESCE(
        (
          SELECT json_agg(
            jsonb_build_object(
              'educator_id', u.user_sys_id,
              'educator_name', CONCAT(u.first_name, ' ', u.last_name),
              'position', se.position
            )
            ORDER BY 
              CASE se.position
                WHEN 'main' THEN 1
                WHEN 'co' THEN 2
                ELSE 3
              END
          )
          FROM section_educator se
          JOIN user_sys u ON se.educator_id = u.user_sys_id
          WHERE se.section_id = s.section_id
            AND se.flag_valid = true
            AND u.flag_valid = true
        ),
        '[]'::json
      ) AS educators

    FROM assignment a
    JOIN post_in_class pic
      ON a.post_id = pic.post_id
     AND pic.flag_valid = true
    JOIN post_content pc
      ON pic.post_content_id = pc.post_content_id
     AND pc.flag_valid = true
    JOIN section s
      ON pic.section_id = s.section_id
    JOIN subject sub
      ON s.subject_id = sub.subject_id

    WHERE pic.section_id = $1
      AND a.flag_valid = true
      AND pc.post_type = 'assignment'

    ORDER BY a.due_date DESC NULLS LAST
    LIMIT $2 OFFSET $3
  `;

    const result = await this.dataSource.query(query, [
      sectionId,
      limit,
      offset,
    ]);

    const assignmentIds = result.map((row) => row.assignment_id);
    this.logger.debug(`[GetClassAssignments]`, 'Assignment', {
      result_length: result.length,
      assignmentIds,
      section_id: sectionId,
      offset,
      limit,
    });

    const final_result = result.map((row: any) => ({
      assignment_id: row.assignment_id,
      post_id: row.post_id,
      title: row.title,
      created_at: row.created_at,
      subject_name_th: row.subject_name_th,
      subject_name_en: row.subject_name_en,
      assignment_type: row.assignment_type,
      is_group: row.is_group,
      due_date: row.due_date,
      total_students: Number(row.total_students),
      submitted_count: Number(row.submitted_count),
      total_groups: Number(row.total_groups),
      submitted_groups: Number(row.submitted_groups),
      educators: row.educators || [],
    }));
    return {
      success: true,
      message: 'Assignments retrieved successfully',
      data: final_result,
    };
  }

  async getPostAssignment(postId: number, userId: number, role?: string) {
    const isStudent = role === 'high school student' || role === 'uni student';

    try {
      /**
       * 1. ดึง post + assignment
       */
      const postQuery = `
SELECT
  pc.post_content_id,
  pc.title,
  pc.content,
  pc.post_type,
  pc.is_anonymous,
  pc.created_at,
  pc.updated_at,

  pic.post_id,
  pic.section_id,

  -- user
  u.user_sys_id        AS _user_sys_id,
  u.email              AS _email,
  u.profile_pic        AS _profile_pic,
  TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS _display_name,
  r.role_name          AS _role_name,

  -- assignment
  a.assignment_id,
  a.due_date,
  a.max_score,
  a.is_group

FROM post_in_class pic
JOIN post_content pc
  ON pic.post_content_id = pc.post_content_id
 AND pc.flag_valid = true

JOIN assignment a
  ON a.post_id = pic.post_id
 AND a.flag_valid = true

JOIN user_sys u
  ON pc.user_sys_id = u.user_sys_id
 AND u.flag_valid = true

JOIN role r
  ON u.role_id = r.role_id
 AND r.flag_valid = true

WHERE pic.post_id = $1
  AND pic.flag_valid = true
  AND pc.post_type = 'assignment'
LIMIT 1
`;

      const postResult = await this.dataSource.query(postQuery, [postId]);

      this.logger.debug('GetPostAssignment ', 'Post Data Retrieved', {
        post_id: postId,
        post_content: postResult[0],
        postResultLength: postResult.length,
      });

      if (!postResult.length) {
        return null;
      }

      const post = postResult[0];
      const isAnonymous = post.is_anonymous;
      const userSysId = Number(post._user_sys_id);
      const sectionId = post.section_id;

      const displayName = isAnonymous
        ? generateAnonymousName(userSysId, sectionId)
        : post._display_name;

      /**
       * 2. ดึง attachment
       */
      const attachmentQuery = `
      SELECT
        attachment_id,
        file_url,
        file_type,
        original_name
      FROM post_attachment
      WHERE post_content_id = $1
        AND flag_valid = true
    `;

      const attachments = await this.dataSource.query(attachmentQuery, [
        post.post_content_id,
      ]);

      /**
       * 3. ดึง submission (เฉพาะ student)
       */
      let submission: any = null;

      if (isStudent && userId) {
        const submissionQuery = `
        SELECT
          sb.submission_id,
          sb.submitted_at,
          sb.marked_at,
          sb.score,
          sb.feedback,
          sg.group_id,
          sg.group_name
        FROM submission sb
        JOIN student_group sg
          ON sb.group_id = sg.group_id
         AND sg.flag_valid = true
        JOIN group_member gm
          ON sg.group_id = gm.group_id
         AND gm.flag_valid = true
        WHERE sb.assignment_id = $1
          AND gm.user_sys_id = $2
          AND sb.flag_valid = true
        ORDER BY sb.submitted_at DESC
        LIMIT 1
      `;

        const submissionResult = await this.dataSource.query(submissionQuery, [
          post.assignment_id,
          userId,
        ]);

        submission = submissionResult.length ? submissionResult[0] : null;

        // Fetch submission attachments if submission exists
        if (submission) {
          const submissionAttachmentQuery = `
            SELECT
              attachment_id,
              file_url,
              original_name,
              file_type
            FROM submission_attachment
            WHERE submission_id = $1
              AND flag_valid = true
            ORDER BY attachment_id
          `;

          const submissionAttachments = await this.dataSource.query(
            submissionAttachmentQuery,
            [submission.submission_id],
          );

          submission.attachments = submissionAttachments;
        }
      }

      let group: any = null;
      let groups: any[] = [];

      if (isStudent && userId) {
        const groupQuery = `
    SELECT
      sg.group_id,
      sg.group_name,
      json_agg(
        jsonb_build_object(
          'user_sys_id', gm.user_sys_id,
          'name', CASE WHEN u.user_sys_id IS NULL THEN 'ไม่มีบัญชีผู้ใช้งาน' ELSE CONCAT(u.first_name, ' ', u.last_name) END,
          'profile_pic', u.profile_pic,
          'is_deleted', (u.user_sys_id IS NULL)
        )
        ORDER BY u.first_name NULLS LAST
      ) AS members
    FROM student_group sg
    JOIN group_member gm
      ON sg.group_id = gm.group_id
     AND gm.flag_valid = true
    LEFT JOIN user_sys u
      ON gm.user_sys_id = u.user_sys_id
     AND u.flag_valid = true
    WHERE sg.assignment_id = $1
      AND sg.flag_valid = true
      AND EXISTS (
        SELECT 1
        FROM group_member gm2
        WHERE gm2.group_id = sg.group_id
          AND gm2.user_sys_id = $2
          AND gm2.flag_valid = true
      )
    GROUP BY sg.group_id, sg.group_name
    LIMIT 1
  `;

        const groupResult = await this.dataSource.query(groupQuery, [
          post.assignment_id,
          userId,
        ]);

        group = groupResult.length ? groupResult[0] : null;
      }

      if (!isStudent) {
        const groupsQuery = `
    SELECT
      sg.group_id,
      sg.group_name,
      json_agg(
        jsonb_build_object(
          'user_sys_id', gm.user_sys_id,
          'name', CASE WHEN u.user_sys_id IS NULL THEN 'ไม่มีบัญชีผู้ใช้งาน' ELSE CONCAT(u.first_name, ' ', u.last_name) END,
          'profile_pic', u.profile_pic,
          'is_deleted', (u.user_sys_id IS NULL)
        )
        ORDER BY u.first_name NULLS LAST
      ) AS members
    FROM student_group sg
    JOIN group_member gm
      ON sg.group_id = gm.group_id
     AND gm.flag_valid = true
    LEFT JOIN user_sys u
      ON gm.user_sys_id = u.user_sys_id
     AND u.flag_valid = true
    WHERE sg.assignment_id = $1
      AND sg.flag_valid = true
    GROUP BY sg.group_id, sg.group_name
    ORDER BY sg.group_name
  `;

        groups = await this.dataSource.query(groupsQuery, [post.assignment_id]);
      }

      const final_result = {
        post: {
          post_id: post.post_id,
          post_content_id: post.post_content_id,
          post_type: post.post_type,
          title: post.title,
          content: post.content,
          is_anonymous: isAnonymous,
          created_at: post.created_at,
          updated_at: post.updated_at,
          section_id: sectionId,
          user: {
            user_sys_id: Number(post._user_sys_id),
            display_name: displayName,
            email: post._email,
            profile_pic: post._profile_pic,
            role_name: post._role_name,
          },
          //for assignment post part
          assignment_id: post.assignment_id,
          due_date: post.due_date,
          max_score: post.max_score,
          is_group: post.is_group,
          attachments,
        },
        //for submission + group part
        assignment: {
          assignment_id: post.assignment_id,
          due_date: post.due_date,
          max_score: post.max_score,
          is_group: post.is_group,
        },
        attachments,
        submission,
        group,
        groups,
      };

      /**
       * 4. shape response
       */
      return {
        success: true,
        message: 'Assignment post retrieved successfully',
        data: final_result,
      };
    } catch (error: any) {
      this.logger.error(
        'get post assignment error',
        'GetPostAssignment',
        error,
      );
      throw new InternalServerErrorException('Error fetching assignment post');
    }
  }

  async createGroup(userId: number, dto: CreateGroupDto) {
    const { assignment_id, group_name, member_ids } = dto;

    this.logger.log('[CreateGroup] Input', 'Assignment Create Group', {
      userId,
      assignment_id,
      group_name,
      member_ids,
    });

    // VALIDATION 1: ต้องมี userId อยู่ใน member_ids
    if (!member_ids.includes(userId)) {
      this.logger.error('[CreateGroup] User must be included in group members');
      throw new Error('You must be a member of the group you create');
    }

    return this.dataSource.transaction(async (manager) => {
      /**
       * 1. ตรวจ assignment
       */
      const assignment = await manager.query(
        `
      SELECT assignment_id
      FROM assignment
      WHERE assignment_id = $1
        AND flag_valid = true
      `,
        [assignment_id],
      );

      if (!assignment.length) {
        throw new Error('Invalid assignment');
      }

      // VALIDATION 2: เช็กว่า userId มีอยู่ใน section นี้หรือไม่
      const enrollment = await manager.query(
        `
      SELECT e.student_id
      FROM assignment a
      JOIN post_in_class pic ON a.post_id = pic.post_id
      JOIN enrollment e ON pic.section_id = e.section_id
      WHERE a.assignment_id = $1
        AND e.student_id = $2
        AND e.flag_valid = true
      `,
        [assignment_id, userId],
      );

      if (!enrollment.length) {
        throw new Error('You are not enrolled in this section');
      }

      // VALIDATION 3: สมาชิกต้อง Active และอยู่ใน section เดียวกัน
      const validMembers = await manager.query(
        `
SELECT u.user_sys_id
FROM user_sys u
JOIN enrollment e ON u.user_sys_id = e.student_id
JOIN assignment a ON a.assignment_id = $1
JOIN post_in_class pic ON a.post_id = pic.post_id
WHERE e.section_id = pic.section_id
  AND u.user_sys_id = ANY($2)
  AND u.user_status = 'Active'
  AND e.flag_valid = true
  AND u.flag_valid = true
`,
        [assignment_id, member_ids],
      );

      if (validMembers.length !== member_ids.length) {
        throw new BadRequestException(
          'Some members are inactive or not enrolled in this section',
        );
      }

      /**
       * 3. สร้าง student_group
       */
      const groupResult = await manager.query(
        `
      INSERT INTO student_group (assignment_id, group_name, flag_valid)
      VALUES ($1, $2, true)
      RETURNING group_id
      `,
        [assignment_id, group_name],
      );

      const groupId = groupResult[0].group_id;
      this.logger.log(
        'Created group with ID:',
        'Assignment Create Group',
        groupId,
      );

      /**
       * 4. เพิ่มสมาชิก
       */
      const values = member_ids
        .map((_, i) => `($1, $${i + 2}, true)`)
        .join(',');

      const insertResult = await manager.query(
        `
      INSERT INTO group_member (group_id, user_sys_id, flag_valid)
      VALUES ${values}
      `,
        [groupId, ...member_ids],
      );

      this.logger.log(
        '[CreateGroup] Inserted group members:',
        'Assignment Create Group',
        insertResult,
      );
      /**
       * 5. response
       */
      const group = {
        group_id: groupId,
        assignment_id,
        group_name,
        members: member_ids.map((id) => ({ user_sys_id: id })),
      };
      this.logger.log(
        '[CreateGroup] Successfully created group:',
        'Assignment Create Group',
        group,
      );

      return {
        success: true,
        message: 'Group created successfully',
        data: group,
      };
    });
  }

  async updateGroup(userId: number, dto: UpdateGroupDto) {
    const { assignment_id, group_id, group_name, member_ids } = dto;

    this.logger.log('[UpdateGroup] Input:', 'Assignment Update Group', {
      userId,
      assignment_id,
      group_id,
      group_name,
      member_ids,
    });

    // VALIDATION 1: ต้องมี userId อยู่ใน member_ids
    if (!member_ids.includes(userId)) {
      this.logger.error('[UpdateGroup] Cannot remove yourself from the group');
      throw new Error('You cannot remove yourself from the group');
    }

    return this.dataSource.transaction(async (manager) => {
      /**
       * 1. ตรวจว่า group นี้มีอยู่จริง และ userId เป็นสมาชิกอยู่
       */
      const group = await manager.query(
        `
      SELECT sg.group_id
      FROM student_group sg
      JOIN group_member gm ON sg.group_id = gm.group_id
      WHERE sg.group_id = $1
        AND sg.assignment_id = $2
        AND gm.user_sys_id = $3
        AND sg.flag_valid = true
        AND gm.flag_valid = true
      `,
        [group_id, assignment_id, userId],
      );

      this.logger.log(
        '[UpdateGroup] Found group:',
        'Assignment Update Group',
        group,
      );

      if (!group.length) {
        this.logger.error(
          '[UpdateGroup] Invalid group - not found or user not a member',
          'Assignment Update Group',
        );
        throw new Error('Group not found or you are not a member');
      }

      // VALIDATION: สมาชิกต้อง Active และอยู่ใน section
      // สมาชิกที่อยู่ในกลุ่มเดิมแล้ว (แม้ถูกลบแล้ว) ยังคงอยู่ในกลุ่มได้
      // เฉพาะสมาชิกใหม่ที่จะเพิ่มเข้ามาเท่านั้นที่ต้อง validate
      const currentGroupMembers = await manager.query(
        `SELECT user_sys_id FROM group_member WHERE group_id = $1`,
        [group_id],
      );
      const currentMemberIds = currentGroupMembers.map(
        (m: any) => m.user_sys_id,
      );

      const newMemberIds = member_ids.filter(
        (id) => !currentMemberIds.includes(id),
      );

      if (newMemberIds.length > 0) {
        const validNewMembers = await manager.query(
          `
SELECT u.user_sys_id
FROM user_sys u
JOIN enrollment e ON u.user_sys_id = e.student_id
JOIN assignment a ON a.assignment_id = $1
JOIN post_in_class pic ON a.post_id = pic.post_id
WHERE e.section_id = pic.section_id
  AND u.user_sys_id = ANY($2)
  AND u.user_status = 'Active'
  AND e.flag_valid = true
  AND u.flag_valid = true
`,
          [assignment_id, newMemberIds],
        );

        if (validNewMembers.length !== newMemberIds.length) {
          throw new BadRequestException(
            'Some members are inactive or not enrolled in this section',
          );
        }
      }

      /**
       * 2. update ชื่อกลุ่ม
       */
      const updateResult = await manager.query(
        `
      UPDATE student_group
      SET group_name = $1
      WHERE group_id = $2
      `,
        [group_name, group_id],
      );

      this.logger.log(
        '[UpdateGroup] Updated group name:',
        'Assignment Update Group',
        updateResult,
      );

      /**
       * 3. ลบสมาชิกเก่าทั้งหมด (DELETE แทน soft delete)
       */
      const deleteResult = await manager.query(
        `
      DELETE FROM group_member
      WHERE group_id = $1
      `,
        [group_id],
      );

      this.logger.log(
        '[UpdateGroup] Deleted old members:',
        'Assignment Update Group',
        deleteResult,
      );

      /**
       * 4. เพิ่มสมาชิกใหม่
       */
      if (member_ids && member_ids.length > 0) {
        const values = member_ids
          .map((_, i) => `($1, $${i + 2}, true)`)
          .join(',');

        const insertResult = await manager.query(
          `
        INSERT INTO group_member (group_id, user_sys_id, flag_valid)
        VALUES ${values}
        `,
          [group_id, ...member_ids],
        );

        this.logger.log(
          '[UpdateGroup] Inserted new members:',
          'Assignment Update Group',
          insertResult,
        );
      }

      /**
       * 5. response
       */
      const groupResponse = {
        group_id,
        assignment_id,
        group_name,
        members: member_ids.map((id) => ({ user_sys_id: id })),
      };

      const response = {
        success: true,
        message: 'Group updated successfully',
        data: groupResponse,
      };

      this.logger.log(
        '[UpdateGroup] Response:',
        'Assignment Update Group',
        response,
      );

      return response;
    });
  }

  // assignment.service.ts - เมธอด getGroup
  async getGroup(userId: number, assignmentId: number) {
    const result = await this.dataSource.query(
      `
    SELECT
      sg.group_id,
      sg.group_name,
      json_agg(
        jsonb_build_object(
          'user_sys_id', gm.user_sys_id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'profile_pic', u.profile_pic,
          'name', CASE WHEN u.user_sys_id IS NULL THEN 'ไม่มีบัญชีผู้ใช้งาน' ELSE CONCAT(u.first_name, ' ', u.last_name) END,
          'is_deleted', (u.user_sys_id IS NULL)
        )
        ORDER BY u.first_name NULLS LAST
      ) AS members
    FROM student_group sg
    JOIN group_member gm
      ON sg.group_id = gm.group_id
     AND gm.flag_valid = true
    LEFT JOIN user_sys u
      ON gm.user_sys_id = u.user_sys_id
     AND u.flag_valid = true
    WHERE sg.assignment_id = $1
      AND sg.flag_valid = true
      AND EXISTS (
        SELECT 1
        FROM group_member gm2
        WHERE gm2.group_id = sg.group_id
          AND gm2.user_sys_id = $2
          AND gm2.flag_valid = true
      )
    GROUP BY sg.group_id, sg.group_name
    LIMIT 1
    `,
      [assignmentId, userId],
    );

    if (!result.length) {
      return { data: null };
    }

    const group = result.length ? result[0] : null;

    return {
      success: true,
      message: 'Group retrieved successfully',
      data: group,
    };
  }

  // assignment.service.ts
  async getAllGroups(assignmentId: number) {
    const result = await this.dataSource.query(
      `
    SELECT
      sg.group_id,
      sg.group_name,
      json_agg(
        jsonb_build_object(
          'user_sys_id', gm.user_sys_id,
          'code', u.code,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'profile_pic', u.profile_pic,
          'name', CASE WHEN u.user_sys_id IS NULL THEN 'ไม่มีบัญชีผู้ใช้งาน' ELSE CONCAT(u.first_name, ' ', u.last_name) END,
          'is_deleted', (u.user_sys_id IS NULL)
        )
        ORDER BY u.first_name NULLS LAST
      ) AS members
    FROM student_group sg
    JOIN group_member gm
      ON sg.group_id = gm.group_id
     AND gm.flag_valid = true
    LEFT JOIN user_sys u
      ON gm.user_sys_id = u.user_sys_id
     AND u.flag_valid = true
    WHERE sg.assignment_id = $1
      AND sg.flag_valid = true
    GROUP BY sg.group_id, sg.group_name
    ORDER BY sg.group_name
    `,
      [assignmentId],
    );

    this.logger.log(
      `All Groups Found ${result.length} groups for assignment ${assignmentId}`,
      'Assignment Get All Groups',
    );

    return {
      success: true,
      message: 'Groups retrieved successfully',
      data: result,
    };
  }

  async searchAssignments(
    userId: number,
    sectionId: number,
    keyword: string,
    role: string,
    limit: number = 50,
  ) {
    const isStudent = role === 'high school student' || role === 'uni student';

    this.logger.log(
      `[SearchAssignments] section_id=${sectionId}, keyword=${keyword}, role=${role}, userId=${userId}`,
    );

    try {
      const query = `
        SELECT
          a.assignment_id,
          pic.post_id,
          pc.title,
          pc.created_at,
          sub.name_th AS subject_name_th,
          sub.name_en AS subject_name_en,
          CASE WHEN a.is_group = true THEN 'งานกลุ่ม' ELSE 'งานเดี่ยว' END AS assignment_type,
          a.is_group,
          a.due_date,

          ${
            isStudent
              ? `
          (
            SELECT sb.submitted_at
            FROM submission sb
            JOIN student_group sg ON sb.group_id = sg.group_id
            JOIN group_member gm ON sg.group_id = gm.group_id
            WHERE sb.assignment_id = a.assignment_id
              AND gm.user_sys_id = $2
              AND sb.flag_valid = true
              AND sg.flag_valid = true
              AND gm.flag_valid = true
            ORDER BY sb.submitted_at DESC
            LIMIT 1
          ) AS submitted_at,
          `
              : ''
          }

          (
            SELECT COUNT(*)::int
            FROM enrollment e
            WHERE e.section_id = $1
              AND e.flag_valid = true
          ) AS total_students,

          (
            SELECT COUNT(*)::int
            FROM submission sb
            WHERE sb.assignment_id = a.assignment_id
              AND sb.flag_valid = true
          ) AS submitted_count,

          COALESCE(
            (
              SELECT json_agg(
                jsonb_build_object(
                  'educator_id', u.user_sys_id,
                  'educator_name', CONCAT(u.first_name, ' ', u.last_name),
                  'position', se.position
                )
                ORDER BY 
                  CASE se.position
                    WHEN 'main' THEN 1
                    WHEN 'co' THEN 2
                    ELSE 3
                  END
              )
              FROM section_educator se
              JOIN user_sys u ON se.educator_id = u.user_sys_id
              WHERE se.section_id = s.section_id
                AND se.flag_valid = true
                AND u.flag_valid = true
            ),
            '[]'::json
          ) AS educators

        FROM assignment a
        JOIN post_in_class pic
          ON a.post_id = pic.post_id
         AND pic.flag_valid = true
        JOIN post_content pc
          ON pic.post_content_id = pc.post_content_id
         AND pc.flag_valid = true
        JOIN section s
          ON pic.section_id = s.section_id
        JOIN subject sub
          ON s.subject_id = sub.subject_id

        WHERE pic.section_id = $1
          AND a.flag_valid = true
          AND pc.post_type = 'assignment'
          AND (
            pc.title ILIKE $${isStudent ? '3' : '2'}
            OR pc.content ILIKE $${isStudent ? '3' : '2'}
          )

        ORDER BY a.due_date DESC NULLS LAST
        LIMIT $${isStudent ? '4' : '3'}
      `;

      const searchPattern = `%${keyword}%`;
      const params = isStudent
        ? [sectionId, userId, searchPattern, limit]
        : [sectionId, searchPattern, limit];

      const result = await this.dataSource.query(query, params);

      this.logger.log(`[SearchAssignments] Found ${result.length} assignments`);

      const final_result = result.map((row: any) => ({
        assignment_id: row.assignment_id,
        post_id: row.post_id,
        title: row.title,
        created_at: row.created_at,
        subject_name_th: row.subject_name_th,
        subject_name_en: row.subject_name_en,
        assignment_type: row.assignment_type,
        is_group: row.is_group,
        due_date: row.due_date,
        submitted_at: row.submitted_at || null,
        total_students: Number(row.total_students),
        submitted_count: Number(row.submitted_count),
        educators: row.educators || [],
      }));

      return {
        success: true,
        message: 'Assignments retrieved successfully',
        data: final_result,
      };
    } catch (error: any) {
      this.logger.error('searchAssignments error', 'SearchAssignments', error);
      throw new InternalServerErrorException('Error searching assignments');
    }
  }

  /**
   * Get submission detail by submission_id (for student)
   * - Returns submission info + attachments
   * - Checks if the requesting user is a member of the group (can_edit)
   */
  async getSubmission(userId: number, submissionId: number) {
    this.logger.log('[GetSubmission] Input', 'Assignment Submission', {
      userId,
      submissionId,
    });

    try {
      // 1. Get submission + group info
      const submissionQuery = `
        SELECT
          sb.submission_id,
          sb.assignment_id,
          sb.group_id,
          sb.submitted_at,
          sb.marked_at,
          sb.score,
          sb.feedback,
          sg.group_name,
          a.due_date,
          a.max_score,
          a.is_group
        FROM submission sb
        JOIN student_group sg ON sb.group_id = sg.group_id AND sg.flag_valid = true
        JOIN assignment a ON sb.assignment_id = a.assignment_id AND a.flag_valid = true
        WHERE sb.submission_id = $1
          AND sb.flag_valid = true
      `;

      const submissionResult = await this.dataSource.query(submissionQuery, [
        submissionId,
      ]);

      if (!submissionResult.length) {
        throw new BadRequestException('Submission not found');
      }

      const submission = submissionResult[0];

      // 2. Get attachments
      const attachmentQuery = `
        SELECT
          attachment_id,
          file_url,
          original_name,
          file_type
        FROM submission_attachment
        WHERE submission_id = $1
          AND flag_valid = true
        ORDER BY attachment_id
      `;

      const attachments = await this.dataSource.query(attachmentQuery, [
        submissionId,
      ]);

      // 3. Check if requesting user is a member of this group (can edit)
      const membershipQuery = `
        SELECT gm.group_id
        FROM group_member gm
        WHERE gm.group_id = $1
          AND gm.user_sys_id = $2
          AND gm.flag_valid = true
      `;

      const membership = await this.dataSource.query(membershipQuery, [
        submission.group_id,
        userId,
      ]);

      const canEdit = membership.length > 0;

      // 4. Check if due date has passed (affects editability)
      const dueDate = submission.due_date;
      const isPastDue = dueDate ? new Date(dueDate) < new Date() : false;

      // 5. Get group members
      const membersQuery = `
        SELECT
          gm.user_sys_id,
          u.first_name,
          u.last_name,
          u.profile_pic,
          CASE WHEN u.user_sys_id IS NULL THEN 'ไม่มีบัญชีผู้ใช้งาน' ELSE CONCAT(u.first_name, ' ', u.last_name) END AS name,
          (u.user_sys_id IS NULL) AS is_deleted
        FROM group_member gm
        LEFT JOIN user_sys u ON gm.user_sys_id = u.user_sys_id AND u.flag_valid = true
        WHERE gm.group_id = $1
          AND gm.flag_valid = true
        ORDER BY u.first_name NULLS LAST
      `;

      const members = await this.dataSource.query(membersQuery, [
        submission.group_id,
      ]);

      this.logger.log('[GetSubmission] Result', 'Assignment Submission', {
        submission_id: submissionId,
        attachmentCount: attachments.length,
        canEdit,
        isPastDue,
        memberCount: members.length,
      });

      const final_result = {
        submission_id: submission.submission_id,
        assignment_id: submission.assignment_id,
        group_id: submission.group_id,
        group_name: submission.group_name,
        submitted_at: submission.submitted_at,
        marked_at: submission.marked_at,
        score: submission.score,
        feedback: submission.feedback,
        due_date: submission.due_date,
        max_score: submission.max_score,
        is_group: submission.is_group,
        is_past_due: isPastDue,
        can_edit: canEdit && !isPastDue,
        is_member: canEdit,
        members,
        attachments,
      };

      return {
        success: true,
        message: 'Submission retrieved successfully',
        data: final_result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        '[GetSubmission] Error:',
        'Assignment Submission',
        error,
      );
      throw new InternalServerErrorException('Error fetching submission');
    }
  }

  /**
   * Create a new submission for an assignment
   * - Validates assignment exists and is valid
   * - Validates user is a member of the group
   * - Checks no existing submission for this group+assignment
   * - Creates submission record
   * - Creates submission_attachment records if files provided
   */
  async createSubmission(
    userId: number,
    dto: {
      assignment_id: number;
      group_id?: number;
      files?: { file_url: string; original_name: string; file_type: string }[];
    },
  ) {
    const { assignment_id, files } = dto;
    let { group_id } = dto;

    this.logger.log('[CreateSubmission] Input', 'Assignment Submission', {
      userId,
      assignment_id,
      group_id,
      fileCount: files?.length || 0,
    });

    return this.dataSource.transaction(async (manager) => {
      // 1. Validate assignment exists
      const assignment = await manager.query(
        `SELECT assignment_id, due_date, is_group
         FROM assignment
         WHERE assignment_id = $1 AND flag_valid = true`,
        [assignment_id],
      );

      if (!assignment.length) {
        throw new BadRequestException('Assignment not found');
      }

      const isGroup = assignment[0].is_group;

      // 2. For individual assignments (is_group = false): auto-resolve or create solo group
      if (!isGroup) {
        // Try to find existing solo group for this user
        const existingSoloGroup = await manager.query(
          `SELECT sg.group_id
           FROM student_group sg
           JOIN group_member gm ON sg.group_id = gm.group_id AND gm.flag_valid = true
           WHERE sg.assignment_id = $1
             AND gm.user_sys_id = $2
             AND sg.flag_valid = true
           LIMIT 1`,
          [assignment_id, userId],
        );

        if (existingSoloGroup.length) {
          group_id = existingSoloGroup[0].group_id;
          this.logger.log(
            '[CreateSubmission] Found existing solo group',
            'Assignment Submission',
            { group_id },
          );
        } else {
          // Create solo group automatically
          const soloGroupResult = await manager.query(
            `INSERT INTO student_group (assignment_id, group_name, flag_valid)
             VALUES ($1, $2, true)
             RETURNING group_id`,
            [assignment_id, `individual_student_${userId}`],
          );
          group_id = soloGroupResult[0].group_id;

          await manager.query(
            `INSERT INTO group_member (group_id, user_sys_id, flag_valid)
             VALUES ($1, $2, true)`,
            [group_id, userId],
          );
          this.logger.log(
            '[CreateSubmission] Created solo group',
            'Assignment Submission',
            { group_id },
          );
        }
      }

      // 3. For group assignments: group_id is required
      if (isGroup && !group_id) {
        throw new BadRequestException(
          'group_id is required for group assignments',
        );
      }

      if (!group_id) {
        throw new BadRequestException('Could not resolve group_id');
      }

      // 4. Validate user is a member of the group
      const membership = await manager.query(
        `SELECT gm.group_id
         FROM group_member gm
         JOIN student_group sg ON gm.group_id = sg.group_id
         WHERE gm.group_id = $1
           AND gm.user_sys_id = $2
           AND gm.flag_valid = true
           AND sg.assignment_id = $3
           AND sg.flag_valid = true`,
        [group_id, userId, assignment_id],
      );

      if (!membership.length) {
        throw new BadRequestException('You are not a member of this group');
      }

      // 5. Check no existing submission for this group + assignment
      const existingSubmission = await manager.query(
        `SELECT submission_id
         FROM submission
         WHERE assignment_id = $1
           AND group_id = $2
           AND flag_valid = true`,
        [assignment_id, group_id],
      );

      if (existingSubmission.length) {
        throw new BadRequestException(
          'Submission already exists. Use update-submission to modify.',
        );
      }

      // 6. Create submission
      const submissionResult = await manager.query(
        `INSERT INTO submission (assignment_id, group_id, submitted_at, flag_valid)
         VALUES ($1, $2, NOW(), true)
         RETURNING submission_id, submitted_at`,
        [assignment_id, group_id],
      );

      const submission = submissionResult[0];

      this.logger.log(
        '[CreateSubmission] Created submission',
        'Assignment Submission',
        {
          submission_id: submission.submission_id,
          submitted_at: submission.submitted_at,
        },
      );

      // 7. Create submission_attachment records if files provided
      const attachments: any[] = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const attachResult = await manager.query(
            `INSERT INTO submission_attachment (submission_id, file_url, original_name, file_type, flag_valid)
             VALUES ($1, $2, $3, $4, true)
             RETURNING attachment_id, file_url, original_name, file_type`,
            [
              submission.submission_id,
              file.file_url,
              file.original_name,
              file.file_type,
            ],
          );

          attachments.push(attachResult[0]);
        }

        this.logger.log(
          '[CreateSubmission] Attached files',
          'Assignment Submission',
          {
            count: attachments.length,
          },
        );
      }

      const final_result = {
        submission_id: submission.submission_id,
        assignment_id,
        group_id,
        submitted_at: submission.submitted_at,
        attachments,
      };

      return {
        success: true,
        message: 'Submission created successfully',
        data: final_result,
      };
    });
  }

  /**
   * Update an existing submission
   * - Validates due_date has not passed
   * - Validates user is a member of the group
   * - Soft-deletes old attachments
   * - Creates new attachment records
   * - Updates submitted_at timestamp
   */
  async updateSubmission(
    userId: number,
    dto: {
      submission_id: number;
      assignment_id: number;
      group_id?: number;
      files?: { file_url: string; original_name: string; file_type: string }[];
    },
  ) {
    const { submission_id, assignment_id, files } = dto;
    let { group_id } = dto;

    this.logger.log('[UpdateSubmission] Input', 'Assignment Submission', {
      userId,
      submission_id,
      assignment_id,
      group_id,
      fileCount: files?.length || 0,
    });

    return this.dataSource.transaction(async (manager) => {
      // 1. Validate assignment exists and check due_date
      const assignment = await manager.query(
        `SELECT assignment_id, due_date, is_group
         FROM assignment
         WHERE assignment_id = $1 AND flag_valid = true`,
        [assignment_id],
      );

      if (!assignment.length) {
        throw new BadRequestException('Assignment not found');
      }

      const dueDate = assignment[0].due_date;
      if (dueDate && new Date(dueDate) < new Date()) {
        throw new BadRequestException(
          'Cannot update submission after due date',
        );
      }

      // Auto-resolve group_id for individual assignments
      if (!group_id) {
        const existingGroup = await manager.query(
          `SELECT sg.group_id
           FROM student_group sg
           JOIN group_member gm ON sg.group_id = gm.group_id AND gm.flag_valid = true
           WHERE sg.assignment_id = $1
             AND gm.user_sys_id = $2
             AND sg.flag_valid = true
           LIMIT 1`,
          [assignment_id, userId],
        );
        if (existingGroup.length) {
          group_id = existingGroup[0].group_id;
          this.logger.log(
            '[UpdateSubmission] Auto-resolved group_id',
            'Assignment Submission',
            { group_id },
          );
        }
      }

      if (!group_id) {
        throw new BadRequestException('group_id is required');
      }

      // 2. Validate user is a member of the group
      const membership = await manager.query(
        `SELECT gm.group_id
         FROM group_member gm
         JOIN student_group sg ON gm.group_id = sg.group_id
         WHERE gm.group_id = $1
           AND gm.user_sys_id = $2
           AND gm.flag_valid = true
           AND sg.assignment_id = $3
           AND sg.flag_valid = true`,
        [group_id, userId, assignment_id],
      );

      if (!membership.length) {
        throw new BadRequestException('You are not a member of this group');
      }

      // 3. Validate submission exists
      const existingSubmission = await manager.query(
        `SELECT submission_id
         FROM submission
         WHERE submission_id = $1
           AND assignment_id = $2
           AND group_id = $3
           AND flag_valid = true`,
        [submission_id, assignment_id, group_id],
      );

      if (!existingSubmission.length) {
        throw new BadRequestException('Submission not found');
      }

      // 4. Hard-delete old attachments
      await manager.query(
        `DELETE FROM submission_attachment
         WHERE submission_id = $1`,
        [submission_id],
      );

      this.logger.log(
        '[UpdateSubmission] Old attachments deleted',
        'Assignment Submission',
        {
          submission_id,
        },
      );

      // 5. Create new attachment records
      const attachments: any[] = [];

      if (files && files.length > 0) {
        for (const file of files) {
          const attachResult = await manager.query(
            `INSERT INTO submission_attachment (submission_id, file_url, original_name, file_type, flag_valid)
             VALUES ($1, $2, $3, $4, true)
             RETURNING attachment_id, file_url, original_name, file_type`,
            [submission_id, file.file_url, file.original_name, file.file_type],
          );

          attachments.push(attachResult[0]);
        }
      }

      // 6. Update submitted_at
      const updateResult = await manager.query(
        `UPDATE submission
         SET submitted_at = NOW()
         WHERE submission_id = $1
         RETURNING submitted_at`,
        [submission_id],
      );

      this.logger.log(
        '[UpdateSubmission] Submission updated',
        'Assignment Submission',
        {
          submission_id,
          new_submitted_at: updateResult[0].submitted_at,
          attachmentCount: attachments.length,
        },
      );
      const final_result = {
        submission_id,
        assignment_id,
        group_id,
        submitted_at: updateResult[0].submitted_at,
        attachments,
      };

      return {
        success: true,
        message: 'Submission updated successfully',
        data: final_result,
      };
    });
  }

  /**
   * Grade a submission (teacher only)
   * - Sets score, feedback, and marked_at
   * - At least one of score or feedback must be provided
   */
  async gradeSubmission(
    userId: number,
    dto: { submission_id: number; score?: number; feedback?: string },
  ) {
    const { submission_id, score, feedback } = dto;

    this.logger.log('[GradeSubmission] Input', 'Assignment Grading', {
      userId,
      submission_id,
      score,
      feedback,
    });

    if (score === undefined || score === null) {
      throw new BadRequestException('Score is required for grading');
    }

    try {
      // 1. Validate submission exists
      const submissionResult = await this.dataSource.query(
        `SELECT sb.submission_id, sb.assignment_id, sb.group_id, a.max_score
         FROM submission sb
         JOIN assignment a ON sb.assignment_id = a.assignment_id AND a.flag_valid = true
         WHERE sb.submission_id = $1
           AND sb.flag_valid = true`,
        [submission_id],
      );

      if (!submissionResult.length) {
        throw new BadRequestException('Submission not found');
      }

      const submission = submissionResult[0];

      // 2. Guard: งานเดี่ยว — ถ้า submitter ถูกลบแล้ว ห้ามให้คะแนน
      if (!submission.is_group) {
        const deletedCheck = await this.dataSource.query(
          `SELECT 1
           FROM group_member gm
           LEFT JOIN user_sys u ON gm.user_sys_id = u.user_sys_id AND u.flag_valid = true
           WHERE gm.group_id = $1
             AND gm.flag_valid = true
             AND u.user_sys_id IS NULL
           LIMIT 1`,
          [submission.group_id],
        );
        if (deletedCheck.length) {
          throw new BadRequestException(
            'ไม่มีบัญชีผู้ใช้งาน ไม่สามารถให้คะแนนและข้อแนะนำได้',
          );
        }
      }

      // 3. Validate score does not exceed max_score
      if (
        score !== undefined &&
        submission.max_score !== null &&
        score > submission.max_score
      ) {
        throw new BadRequestException(
          `Score (${score}) cannot exceed max score (${submission.max_score})`,
        );
      }

      if (score !== undefined && score < 0) {
        throw new BadRequestException('Score cannot be negative');
      }

      // 4. Build dynamic SET clause
      const setClauses: string[] = ['marked_at = NOW()'];
      const params: any[] = [submission_id];
      let paramIndex = 2;

      if (score !== undefined) {
        setClauses.push(`score = $${paramIndex}`);
        params.push(score);
        paramIndex++;
      }

      if (feedback !== undefined && feedback !== null) {
        setClauses.push(`feedback = $${paramIndex}`);
        params.push(feedback);
        paramIndex++;
      }

      // 5. Update submission
      const updateQuery = `
        UPDATE submission
        SET ${setClauses.join(', ')}
        WHERE submission_id = $1
        RETURNING submission_id, score, feedback, marked_at
      `;

      const updateResult = await this.dataSource.query(updateQuery, params);

      const updated = updateResult[0];

      this.logger.log(
        '[GradeSubmission] Graded successfully',
        'Assignment Grading',
        {
          submission_id: updated.submission_id,
          score: updated.score,
          feedback: updated.feedback,
          marked_at: updated.marked_at,
        },
      );

      const final_result = {
        submission_id: updated.submission_id,
        assignment_id: submission.assignment_id,
        group_id: submission.group_id,
        score: updated.score,
        feedback: updated.feedback,
        marked_at: updated.marked_at,
        max_score: submission.max_score,
      };

      return {
        success: true,
        message: 'Submission graded successfully',
        data: final_result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        '[GradeSubmission] Error:',
        'Assignment Grading',
        error,
      );
      throw new InternalServerErrorException('Error grading submission');
    }
  }

  /**
   * Get all students with their submission status for a given assignment (Teacher view)
   */
  async getStudentsSubmissionStatus(assignmentId: number) {
    this.logger.log(
      '[GetStudentsSubmissionStatus] assignmentId:',
      'Assignment',
      { assignmentId },
    );

    try {
      // Get assignment info (to find sectionId)
      const assignmentQuery = `
        SELECT a.assignment_id, pic.section_id
        FROM assignment a
        JOIN post_in_class pic ON a.post_id = pic.post_id AND pic.flag_valid = true
        WHERE a.assignment_id = $1 AND a.flag_valid = true
        LIMIT 1
      `;
      const assignmentResult = await this.dataSource.query(assignmentQuery, [
        assignmentId,
      ]);
      if (!assignmentResult.length)
        return { success: false, message: 'Assignment not found', data: [] };

      const sectionId = Number(assignmentResult[0].section_id);

      const query = `
        SELECT
          COALESCE(u.user_sys_id, e.student_id) AS user_sys_id,
          u.first_name,
          u.last_name,
          u.profile_pic,
          u.code,
          (u.user_sys_id IS NULL) AS is_deleted,

          sb.submission_id,
          sb.submitted_at,
          sb.score,
          sb.feedback,
          sb.marked_at,

          sb.group_id,
          sb.group_name,

          CASE
            WHEN sb.submission_id IS NOT NULL THEN 'submitted'
            ELSE 'not_submitted'
          END AS submission_status

        FROM enrollment e
        LEFT JOIN user_sys u ON e.student_id = u.user_sys_id AND u.flag_valid = true

        LEFT JOIN (
          SELECT DISTINCT ON (gm.user_sys_id)
            gm.user_sys_id,
            sub.submission_id,
            sub.submitted_at,
            sub.score,
            sub.feedback,
            sub.marked_at,
            grp.group_id,
            grp.group_name
          FROM submission sub
          JOIN student_group grp ON sub.group_id = grp.group_id AND grp.flag_valid = true
          JOIN group_member gm ON grp.group_id = gm.group_id AND gm.flag_valid = true
          WHERE sub.assignment_id = $1 AND sub.flag_valid = true
          ORDER BY gm.user_sys_id, sub.submitted_at DESC
        ) sb ON sb.user_sys_id = e.student_id

        WHERE e.section_id = $2
          AND e.flag_valid = true

        ORDER BY
          CASE WHEN u.user_sys_id IS NULL THEN 1 ELSE 0 END,
          CASE WHEN sb.submitted_at IS NOT NULL THEN 0 ELSE 1 END,
          sb.submitted_at DESC NULLS LAST,
          u.first_name ASC NULLS LAST
      `;

      const result = await this.dataSource.query(query, [
        assignmentId,
        sectionId,
      ]);

      this.logger.log(
        `[GetStudentsSubmissionStatus] Found ${result.length} students`,
        'Assignment',
      );

      const data = result.map((row: any) => ({
        user_sys_id: row.user_sys_id ? Number(row.user_sys_id) : null,
        first_name: row.is_deleted ? null : row.first_name,
        last_name: row.is_deleted ? null : row.last_name,
        display_name: row.is_deleted
          ? 'ไม่มีบัญชีผู้ใช้งาน'
          : `${row.first_name} ${row.last_name}`,
        profile_pic: row.is_deleted ? null : row.profile_pic,
        code: row.is_deleted ? null : row.code,
        is_deleted: row.is_deleted,
        submission_id: row.submission_id ? Number(row.submission_id) : null,
        submitted_at: row.submitted_at,
        score: row.score,
        feedback: row.feedback,
        marked_at: row.marked_at,
        group_id: row.group_id ? Number(row.group_id) : null,
        group_name: row.group_name,
        submission_status: row.submission_status,
      }));

      return {
        success: true,
        message: 'Students submission status retrieved successfully',
        data,
      };
    } catch (error) {
      this.logger.error(
        '[GetStudentsSubmissionStatus] Error:',
        'Assignment',
        error,
      );
      throw new InternalServerErrorException(
        'Error fetching students submission status',
      );
    }
  }

  /**
   * Get submission detail for teacher (by submission_id) - simple version
   * Returns submission + attachments + group info
   */
  async getSubmissionDetailForTeacher(submissionId: number) {
    this.logger.log('[GetSubmissionDetail] submissionId:', 'Assignment', {
      submissionId,
    });

    try {
      const query = `
        SELECT
          sb.submission_id,
          sb.assignment_id,
          sb.submitted_at,
          sb.score,
          sb.feedback,
          sb.marked_at,
          sg.group_id,
          sg.group_name,
          a.max_score,
          a.due_date,
          a.is_group
        FROM submission sb
        JOIN student_group sg ON sb.group_id = sg.group_id AND sg.flag_valid = true
        JOIN assignment a ON sb.assignment_id = a.assignment_id AND a.flag_valid = true
        WHERE sb.submission_id = $1
          AND sb.flag_valid = true
      `;

      const result = await this.dataSource.query(query, [submissionId]);
      if (!result.length)
        return { success: false, message: 'Submission not found', data: null };

      const submission = result[0];

      // Get attachments
      const attachmentQuery = `
        SELECT
          attachment_id,
          file_url,
          original_name,
          file_type
        FROM submission_attachment
        WHERE submission_id = $1 AND flag_valid = true
        ORDER BY attachment_id
      `;
      const attachments = await this.dataSource.query(attachmentQuery, [
        submissionId,
      ]);

      // Get submitter(s) info with deleted user pattern
      const membersQuery = `
        SELECT
          gm.user_sys_id,
          u.first_name,
          u.last_name,
          u.profile_pic,
          CASE WHEN u.user_sys_id IS NULL THEN 'ไม่มีบัญชีผู้ใช้งาน'
               ELSE CONCAT(u.first_name, ' ', u.last_name) END AS display_name,
          (u.user_sys_id IS NULL) AS is_deleted
        FROM group_member gm
        LEFT JOIN user_sys u ON gm.user_sys_id = u.user_sys_id AND u.flag_valid = true
        WHERE gm.group_id = $1
          AND gm.flag_valid = true
        ORDER BY u.first_name NULLS LAST
      `;
      const members = await this.dataSource.query(membersQuery, [
        submission.group_id,
      ]);

      // สำหรับงานเดี่ยว: ห้ามให้คะแนนถ้า submitter ถูกลบแล้ว
      const isGroup = submission.is_group;
      const hasDeletedMember = members.some((m: any) => m.is_deleted);
      const can_grade = !(isGroup === false && hasDeletedMember);
      const grade_disabled_reason =
        !can_grade
          ? 'ไม่มีบัญชีผู้ใช้งาน ไม่สามารถให้คะแนนและข้อแนะนำได้'
          : null;

      const data_result = {
        submission_id: Number(submission.submission_id),
        assignment_id: Number(submission.assignment_id),
        submitted_at: submission.submitted_at,
        score: submission.score,
        feedback: submission.feedback,
        marked_at: submission.marked_at,
        group_id: submission.group_id ? Number(submission.group_id) : null,
        group_name: submission.group_name,
        max_score: submission.max_score,
        due_date: submission.due_date,
        is_group: submission.is_group,
        attachments,
        members,
        can_grade,
        grade_disabled_reason,
      };

      return {
        success: true,
        message: 'Submission detail retrieved successfully',
        data: data_result,
      };
    } catch (error) {
      this.logger.error('[GetSubmissionDetail] Error:', 'Assignment', error);
      throw new InternalServerErrorException(
        'Error fetching submission detail',
      );
    }
  }
}
