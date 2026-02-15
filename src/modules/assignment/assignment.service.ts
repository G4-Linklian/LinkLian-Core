import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GetClassAssignmentsDto, CreateGroupDto , UpdateGroupDto } from './dto/assignment.dto';
import { generateAnonymousName } from '../../common/utils/anonymous.util';

@Injectable()
export class AssignmentService {
  constructor(private dataSource: DataSource) { }


  async getClassAssignments(userId: number, dto: GetClassAssignmentsDto) {
  const { section_id, role, offset = 0, limit = 10 } = dto;
    
    const isStudent =
      role === 'high school student' ||
      role === 'uni student';

  console.log(`[GetClassAssignments] section_id=${section_id}, role=${role}, userId=${userId}, offset=${offset}, limit=${limit}`);

    try {
     if (isStudent && userId) {
      return await this.getStudentAssignments(section_id, userId, offset, limit);
    } else {
      return await this.getTeacherAssignments(section_id, offset, limit);
    }
    } catch (error) {
      console.error('[GetClassAssignments] Error:', error);
      throw new InternalServerErrorException('Error fetching assignments');
    }
  }

private async getStudentAssignments(sectionId: number, userId: number, offset: number, limit: number) {
    const query = `
      SELECT
        a.assignment_id,
        pic.post_id,
        pc.title,
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

const result = await this.dataSource.query(
  query,
  [sectionId, userId, limit, offset],
);    console.log(`[GetClassAssignments] Student query returned ${result.length} assignments`);

    return result.map((row: any) => ({
      assignment_id: row.assignment_id,
      post_id: row.post_id,
      title: row.title,
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
  }

private async getTeacherAssignments(sectionId: number, offset: number, limit: number) {
  const query = `
    SELECT
      a.assignment_id,
      pic.post_id,
      pc.title,
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

const result = await this.dataSource.query(
  query,
  [sectionId, limit, offset],
);
  console.log(`[GetClassAssignments] Teacher query returned ${result.length} assignments`);

  return result.map((row: any) => ({
    assignment_id: row.assignment_id,
    post_id: row.post_id,
    title: row.title,
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
}

  async getPostAssignment(
    postId: number,
    userId: number,
    role?: string,
  ) {
    const isStudent =
      role === 'student' ||
      role === 'high school student' ||
      role === 'uni student';

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

      const attachments = await this.dataSource.query(
        attachmentQuery,
        [post.post_content_id],
      );

      /**
       * 3. ดึง submission (เฉพาะ student)
       */
      let submission = null;

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

        const submissionResult = await this.dataSource.query(
          submissionQuery,
          [post.assignment_id, userId],
        );

        submission = submissionResult.length ? submissionResult[0] : null;
      }


      let group = null;
      let groups = [];

      if (isStudent && userId) {
        const groupQuery = `
    SELECT
      sg.group_id,
      sg.group_name,
      json_agg(
        jsonb_build_object(
          'user_sys_id', u.user_sys_id,
          'name', CONCAT(u.first_name, ' ', u.last_name)
        )
        ORDER BY u.first_name
      ) AS members
    FROM student_group sg
    JOIN group_member gm
      ON sg.group_id = gm.group_id
     AND gm.flag_valid = true
    JOIN user_sys u
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

        const groupResult = await this.dataSource.query(
          groupQuery,
          [post.assignment_id, userId],
        );

        group = groupResult.length ? groupResult[0] : null;
      }

      if (!isStudent) {
        const groupsQuery = `
    SELECT
      sg.group_id,
      sg.group_name,
      json_agg(
        jsonb_build_object(
          'user_sys_id', u.user_sys_id,
          'name', CONCAT(u.first_name, ' ', u.last_name)
        )
        ORDER BY u.first_name
      ) AS members
    FROM student_group sg
    JOIN group_member gm
      ON sg.group_id = gm.group_id
     AND gm.flag_valid = true
    JOIN user_sys u
      ON gm.user_sys_id = u.user_sys_id
     AND u.flag_valid = true
    WHERE sg.assignment_id = $1
      AND sg.flag_valid = true
    GROUP BY sg.group_id, sg.group_name
    ORDER BY sg.group_name
  `;

        groups = await this.dataSource.query(
          groupsQuery,
          [post.assignment_id],
        );
      }

      /**
       * 4. shape response
       */
      return {
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


          // 🔑 จุดสำคัญ
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
              email: post._email,
              profile_pic: post._profile_pic,
              display_name: post._display_name,
              role_name: post._role_name,
            },

          // assignment fields (PostModel ใช้ได้)
          due_date: post.due_date,
          max_score: post.max_score,
          is_group: post.is_group,
        },

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
    } catch (error) {
      console.error('[getPostAssignment] error:', error);
      throw new InternalServerErrorException(
        'Error fetching assignment post',
      );
    }
  }

async createGroup(
  userId: number,
  dto: CreateGroupDto,
) {
  const { assignment_id, group_name, member_ids } = dto;

  console.log('[createGroup] Input:', { userId, assignment_id, group_name, member_ids });

  // ✅ VALIDATION 1: ต้องมี userId อยู่ใน member_ids
  if (!member_ids.includes(userId)) {
    console.error('[createGroup] User must be included in group members');
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
        AND is_group = true
        AND flag_valid = true
      `,
      [assignment_id],
    );

    if (!assignment.length) {
      throw new Error('Invalid assignment');
    }

    // ✅ VALIDATION 2: เช็กว่า userId มีอยู่ใน section นี้หรือไม่
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

    /**
     * 4. เพิ่มสมาชิก
     */
    const values = member_ids
      .map((_, i) => `($1, $${i + 2}, true)`)
      .join(',');

    await manager.query(
      `
      INSERT INTO group_member (group_id, user_sys_id, flag_valid)
      VALUES ${values}
      `,
      [groupId, ...member_ids],
    );

    console.log('[createGroup] Success:', { groupId, member_count: member_ids.length });

    /**
     * 5. response
     */
    return {
      success: true,
      group: {
        group_id: groupId,
        assignment_id,
        group_name,
        members: member_ids.map((id) => ({ user_sys_id: id })),
      },
    };
  });
}

async updateGroup(
  userId: number,
  dto: UpdateGroupDto,
) {
  const { assignment_id, group_id, group_name, member_ids } = dto;

  console.log('[updateGroup] Input:', { userId, assignment_id, group_id, group_name, member_ids });

  // ✅ VALIDATION 1: ต้องมี userId อยู่ใน member_ids
  if (!member_ids.includes(userId)) {
    console.error('[updateGroup] Cannot remove yourself from the group');
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

    console.log('[updateGroup] Found group:', group);

    if (!group.length) {
      console.error('[updateGroup] Invalid group - not found or user not a member');
      throw new Error('Group not found or you are not a member');
    }

    /**
     * 2. update ชื่อกลุ่ม
     */
    await manager.query(
      `
      UPDATE student_group
      SET group_name = $1
      WHERE group_id = $2
      `,
      [group_name, group_id],
    );

    console.log('[updateGroup] Updated group name');

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

    console.log('[updateGroup] Deleted old members:', deleteResult);

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

      console.log('[updateGroup] Inserted new members:', insertResult);
    }

    /**
     * 5. response
     */
    const response = {
      success: true,
      group: {
        group_id,
        assignment_id,
        group_name,
        members: member_ids.map((id) => ({ user_sys_id: id })),
      },
    };

    console.log('[updateGroup] Response:', response);

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
  'user_sys_id', u.user_sys_id,
  'first_name', u.first_name,
  'last_name', u.last_name,
  'profile_pic', u.profile_pic,
  'name', CONCAT(u.first_name, ' ', u.last_name)
)
        ORDER BY u.first_name
      ) AS members
    FROM student_group sg
    JOIN group_member gm
      ON sg.group_id = gm.group_id
     AND gm.flag_valid = true
    JOIN user_sys u
      ON gm.user_sys_id = u.user_sys_id
     AND u.user_status = 'Active'
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
    return { data: null };  // ✅ ส่ง null ในรูปแบบเดียวกัน
  }

  // ✅ ห่อด้วย data เหมือน endpoint อื่นๆ
  return { data: result[0] };
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
          'user_sys_id', u.user_sys_id,
          'code', u.code,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'profile_pic', u.profile_pic,
          'name', CONCAT(u.first_name, ' ', u.last_name)
        )
        ORDER BY u.first_name
      ) AS members
    FROM student_group sg
    JOIN group_member gm
      ON sg.group_id = gm.group_id
     AND gm.flag_valid = true
    JOIN user_sys u
      ON gm.user_sys_id = u.user_sys_id
     AND u.user_status = 'Active'
    WHERE sg.assignment_id = $1
      AND sg.flag_valid = true
    GROUP BY sg.group_id, sg.group_name
    ORDER BY sg.group_name
    `,
    [assignmentId],
  );

  console.log(`[getAllGroups] Found ${result.length} groups for assignment ${assignmentId}`);

  return { data: result };
}



}