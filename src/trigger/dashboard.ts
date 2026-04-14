import { logger, schedules } from "@trigger.dev/sdk/v3";
import { DataSource, QueryRunner } from 'typeorm';
import { triggerDataSourceOptions } from "./trigger-db";
import { AppLogger } from 'src/common/logger/app-logger.service';
import { chunkArray } from 'src/common/utils/chunkArrays.util';
import dayjs from 'dayjs';

const applogger = new AppLogger();

const dataSource = new DataSource(triggerDataSourceOptions);

const BATCH_SIZE = 500;

export const dashboardTask = schedules.task({
    id: "dashboard-task",
    // Every 1st of each month at 3 AM (Thailand time, UTC+7) = 20:00 UTC
    cron: "0 20 1 * *",
    // Set an optional maxDuration to prevent tasks from running indefinitely
    maxDuration: 7200,
    run: async (payload, { ctx }) => {
        const dateNow = new Date();

        const thaiDate = new Date(
            dateNow.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
        );

        const targetMonth = dayjs(thaiDate).subtract(1, 'month').format('YYYY-MM');

        logger.log("Dashboard task started", { thaiDate });
        applogger.log("Dashboard task started", "dashboardTask", { thaiDate });

        const institutions = await getInstitutions();

        if (!institutions || institutions.length === 0) {
            applogger.error("No valid institutions found. Exiting.", "dashboardTask", institutions);
            logger.error("No valid institutions found. Exiting.", { institutions });
            return;
        }

        for (const inst of institutions) {
            const { inst_id } = inst;

            await processInstitutionDashboard(inst_id, targetMonth);
        }

        logger.log("All institutions processed successfully", { totalInst: institutions.length });
        applogger.log("All institutions processed successfully", "dashboardTask", { totalInst: institutions.length });
    },
});

async function ensureDataSourceInitialized() {
    if (!dataSource.isInitialized) {
        await dataSource.initialize();
    }
}

export async function getInstitutions() {
    await ensureDataSourceInitialized();

    const queryRunner = dataSource.createQueryRunner();

    const query = `
        SELECT inst_id
        FROM institution 
        WHERE flag_valid = true
            AND approve_status = 'approved'
    `
    try {
        return await queryRunner.query(query);
    } finally {
        await queryRunner.release();
    }
}

export async function processInstitutionDashboard(instId: number, reportMonth: string) {
    await ensureDataSourceInitialized();

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
        await queryRunner.startTransaction();

        const teacherData = await getTeacherDashboardData(instId, reportMonth, queryRunner);
        const studentData = await getStudentDashboardData(instId, reportMonth, queryRunner);

        const allDataToUpsert = [...teacherData, ...studentData];

        const chunks = chunkArray(allDataToUpsert, BATCH_SIZE);

        for (let i = 0; i < chunks.length; i++) {
            await upsertDashboard(chunks[i], reportMonth, queryRunner);

            logger.log(`Upserted batch ${i + 1} of ${chunks.length}`);
        }

        await queryRunner.commitTransaction();
        applogger.log("Dashboard task completed successfully.", "dashboardTask", { instId, reportMonth });
        logger.log("Dashboard task completed successfully.", { instId, reportMonth });

    } catch (error) {
        await queryRunner.rollbackTransaction();
        applogger.error("Fatal error in dashboard task", "dashboardTask", error);
        logger.error("Fatal error in dashboard task", { error });
        throw error;
    } finally {
        await queryRunner.release();
    }
}

export async function upsertDashboard(dataRows: any[], reportMonth: string, queryRunner: QueryRunner) {
    await ensureDataSourceInitialized();

    if (!dataRows || dataRows.length === 0) return;

    const valuesToInsert = dataRows.map(data => {
        const payloadStr = JSON.stringify(data.payload).replace(/'/g, "''");
        return `(${data.user_sys_id}, '${data.role_type}', '${reportMonth}', '${payloadStr}'::jsonb, NOW(), true)`;
    }).join(',');

    const query = `
        INSERT INTO monthly_dashboard (user_sys_id, role_type, report_month, payload, created_at, flag_valid)
        VALUES ${valuesToInsert}
        ON CONFLICT (user_sys_id, role_type, report_month) 
        DO UPDATE SET 
            payload = EXCLUDED.payload,
            created_at = NOW();
    `;

    await queryRunner.query(query);

    applogger.log("Upserted dashboard data", "dashboardTask", { rowCount: dataRows.length });
    logger.log("Upserted dashboard data", { rowCount: dataRows.length });
}

export async function getTeacherDashboardData(inst_id: number, report_month: string, queryRunner: QueryRunner) {
    await ensureDataSourceInitialized();

    await queryRunner.connect();

    const query = `
        WITH teacher_info AS (
            SELECT user_sys_id
            FROM user_sys 
            WHERE inst_id = $1 AND role_id IN (4, 5)
        ),

        assets_stat AS (
            SELECT 
                ti.user_sys_id,
                jsonb_build_object(
                    'total_qa_live', (
                        SELECT COUNT(*) 
                        FROM qa_live 
                        WHERE live_by = ti.user_sys_id 
                            AND flag_valid = true
                    ),
                    'qa_live_this_month', (
                        SELECT COUNT(*) 
                        FROM qa_live 
                        WHERE live_by = ti.user_sys_id 
                            AND TO_CHAR(started_at, 'YYYY-MM') = $2 
                            AND flag_valid = true
                    ),
                    'total_file', (
                        SELECT COUNT(*) 
                        FROM post_attachment pa 
                        JOIN post_content pc 
                            ON pa.post_content_id = pc.post_content_id 
                        WHERE pc.user_sys_id = ti.user_sys_id 
                            AND pa.flag_valid = true
                    ),
                    'file_this_month', (
                        SELECT COUNT(*) 
                        FROM post_attachment pa 
                        JOIN post_content pc 
                            ON pa.post_content_id = pc.post_content_id 
                        WHERE pc.user_sys_id = ti.user_sys_id 
                            AND TO_CHAR(pc.created_at, 'YYYY-MM') = $2 
                            AND pa.flag_valid = true
                    ),
                    'total_assignment', (
                        SELECT COUNT(*) 
                        FROM assignment a 
                        JOIN post_content pc 
                            ON a.post_id = (
                                SELECT post_id 
                                FROM post_in_class 
                                WHERE post_content_id = pc.post_content_id 
                                LIMIT 1
                            ) 
                        WHERE pc.user_sys_id = ti.user_sys_id 
                            AND a.flag_valid = true
                    ),
                    'assignment_this_month', (
                        SELECT COUNT(*) 
                        FROM assignment a 
                        JOIN post_content pc 
                            ON a.post_id = (
                                SELECT post_id 
                                FROM post_in_class 
                                WHERE post_content_id = pc.post_content_id 
                                LIMIT 1
                            ) 
                        WHERE pc.user_sys_id = ti.user_sys_id 
                            AND TO_CHAR(a.due_date, 'YYYY-MM') = $2 
                            AND a.flag_valid = true
                    )
                ) as assets_data
            FROM teacher_info ti
        ),

        top_bookmarked_posts AS (
            SELECT 
                ranked_posts.teacher_id,
                jsonb_agg(
                    jsonb_build_object(
                        'post_content_id', ranked_posts.post_content_id,
                        'title', ranked_posts.title,
                        'bookmark_count', ranked_posts.bookmark_count
                    ) ORDER BY ranked_posts.bookmark_count DESC
                ) as posts
            FROM (
                SELECT 
                    pc.user_sys_id as teacher_id,
                    pc.post_content_id,
                    pc.title,
                    (
                        SELECT COUNT(*) 
                        FROM bookmark b 
                        JOIN post_in_class pic 
                            ON b.post_id = pic.post_id 
                        WHERE pic.post_content_id = pc.post_content_id
                    ) as bookmark_count,

                    ROW_NUMBER() OVER (
                        PARTITION BY pc.user_sys_id 
                        ORDER BY (
                            SELECT COUNT(*) 
                            FROM bookmark b 
                            JOIN post_in_class pic 
                                ON b.post_id = pic.post_id 
                            WHERE pic.post_content_id = pc.post_content_id
                        ) DESC, pc.created_at DESC
                    ) as rank

                FROM post_content pc
                INNER JOIN teacher_info ti 
                    ON pc.user_sys_id = ti.user_sys_id
            ) ranked_posts

            WHERE ranked_posts.rank <= 5
            GROUP BY ranked_posts.teacher_id
        ),

        teacher_sections AS (
            SELECT 
                se.educator_id as teacher_id,
                jsonb_agg(
                    jsonb_build_object(
                        'section_id', s.section_id,
                        'section_name', s.section_name,
                        'subject_name', sj.name_th,
                        'assignment_stat', (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'assignment_id', ass.assignment_id,
                                    'title', pc_ass.title,
                                    'on_time_count', (
                                        SELECT COUNT(*) 
                                        FROM submission subm 
                                        WHERE subm.assignment_id = ass.assignment_id 
                                            AND subm.submitted_at <= ass.due_date
                                    ),
                                    'late_count', (
                                        SELECT COUNT(*) 
                                        FROM submission subm 
                                        WHERE subm.assignment_id = ass.assignment_id 
                                            AND subm.submitted_at > ass.due_date
                                    ),
                                    'missing_count', (
                                        SELECT COUNT(*) 
                                        FROM enrollment enrm 
                                        WHERE enrm.section_id = s.section_id 
                                            AND NOT EXISTS (
                                                SELECT 1 
                                                FROM submission subm 
                                                WHERE subm.assignment_id = ass.assignment_id 
                                                    AND subm.group_id = (
                                                        SELECT group_id 
                                                        FROM group_member 
                                                        WHERE user_sys_id = enrm.student_id 
                                                        LIMIT 1
                                                    )
                                            )
                                    )
                                )
                            )
                            FROM assignment ass
                            JOIN post_in_class pic_ass 
                                ON ass.post_id = pic_ass.post_id
                            JOIN post_content pc_ass 
                                ON pic_ass.post_content_id = pc_ass.post_content_id
                            WHERE pic_ass.section_id = s.section_id 
                                AND TO_CHAR(ass.due_date, 'YYYY-MM') = $2
                        ),
                        
                        'qa_live_insight', (
                            SELECT jsonb_build_object(
                                'total_live_time_second', COALESCE(SUM(EXTRACT(EPOCH FROM (ql.ended_at - ql.started_at))), 0),
                                'total_question', COUNT(qq.qa_question_id),
                                'top_questioned_file', (
                                    SELECT COALESCE(jsonb_agg(
                                        jsonb_build_object(
                                            'attachment_id', pa.attachment_id,
                                            'attachment_name', pa.original_name,
                                            'top_page', (
                                                SELECT COALESCE(jsonb_agg(
                                                    jsonb_build_object(
                                                        'page_number', sub_page.slide_number, 
                                                        'question_count', sub_page.cnt
                                                    )
                                                ), '[]'::jsonb)
                                                FROM (
                                                    SELECT qq2.slide_number, COUNT(*) as cnt
                                                    FROM qa_question qq2
                                                    WHERE qq2.attachment_id = pa.attachment_id 
                                                        AND qq2.flag_valid = true
                                                    GROUP BY qq2.slide_number 
                                                    ORDER BY cnt DESC LIMIT 5
                                                ) sub_page
                                            )
                                        )
                                    ), '[]'::jsonb)
                                    FROM post_attachment pa 
                                    WHERE pa.post_content_id IN (
                                        SELECT post_content_id 
                                        FROM post_in_class 
                                        WHERE section_id = s.section_id
                                    )
                                        AND pa.flag_valid = true
                                        AND EXISTS (
                                            SELECT 1 
                                            FROM qa_question qcheck 
                                            WHERE qcheck.attachment_id = pa.attachment_id 
                                                AND qcheck.flag_valid = true
                                            )
                                )
                            )
                            FROM qa_live ql
                            LEFT JOIN qa_question qq 
                                ON ql.qa_live_id = qq.qa_live_id
                            WHERE ql.section_id = s.section_id 
                                AND TO_CHAR(ql.started_at, 'YYYY-MM') = $2
                            GROUP BY ql.section_id
                        )
                    )
                ) as sections_data
            FROM section_educator se
            JOIN section s 
                ON se.section_id = s.section_id
            JOIN subject sj 
                ON s.subject_id = sj.subject_id
            INNER JOIN teacher_info ti 
                ON se.educator_id = ti.user_sys_id
            GROUP BY se.educator_id
        )

        SELECT 
            t.user_sys_id,
            'TEACHER' as role_type,
            jsonb_build_object(
                'assets', a.assets_data,
                'top_bookmarked_posts', COALESCE(tp.posts, '[]'::jsonb),
                'section', COALESCE(ts.sections_data, '[]'::jsonb)
            ) as payload
        FROM teacher_info t
        JOIN assets_stat a 
            ON t.user_sys_id = a.user_sys_id
        LEFT JOIN top_bookmarked_posts tp 
            ON t.user_sys_id = tp.teacher_id
        LEFT JOIN teacher_sections ts 
            ON t.user_sys_id = ts.teacher_id;
    `

    return await queryRunner.query(query, [inst_id, report_month]);
}

export async function getStudentDashboardData(inst_id: number, report_month: string, queryRunner: QueryRunner) {
    await ensureDataSourceInitialized();

    await queryRunner.connect();

    const query = `
        WITH student_info AS (
            SELECT user_sys_id
            FROM user_sys 
            WHERE inst_id = $1 AND role_id IN (2, 3)
        ),

        student_assignments AS (
            SELECT 
                si.user_sys_id,
                s.section_id,
                sj.name_th as subject_name,
                a.assignment_id,
                pc.title,
                a.due_date,
                subm.submitted_at,
                subm.score,
                (
                    SELECT gm.group_id 
                    FROM group_member gm 
                    WHERE gm.user_sys_id = si.user_sys_id 
                        AND gm.flag_valid = true 
                    LIMIT 1
                ) as my_group_id

            FROM student_info si
            JOIN enrollment enrm 
                ON si.user_sys_id = enrm.student_id
            JOIN section s 
                ON enrm.section_id = s.section_id
            JOIN subject sj 
                ON s.subject_id = sj.subject_id
            JOIN post_in_class pic 
                ON s.section_id = pic.section_id
            JOIN assignment a 
                ON pic.post_id = a.post_id
            JOIN post_content pc 
                ON pic.post_content_id = pc.post_content_id
            LEFT JOIN submission subm 
                ON a.assignment_id = subm.assignment_id 
            AND EXISTS (
                SELECT 1 
                FROM group_member gm 
                WHERE gm.group_id = subm.group_id 
                    AND gm.user_sys_id = si.user_sys_id 
                    AND gm.flag_valid = true
            )

            WHERE TO_CHAR(a.due_date, 'YYYY-MM') = $2 
                AND a.flag_valid = true
        ),

        student_overview AS (
            SELECT 
                user_sys_id,
                jsonb_build_object(
                    'total_assignments', COUNT(assignment_id),
                    'on_time_total', COUNT(*) FILTER (WHERE submitted_at IS NOT NULL AND submitted_at <= due_date),
                    'late_total', COUNT(*) FILTER (WHERE submitted_at IS NOT NULL AND submitted_at > due_date),
                    'missing_total', COUNT(*) FILTER (WHERE submitted_at IS NULL AND due_date < NOW()),
                    'on_time_rate', CASE 
                        WHEN COUNT(assignment_id) > 0 THEN 
                            ROUND((COUNT(*) FILTER (
                                WHERE submitted_at IS NOT NULL 
                                    AND submitted_at <= due_date
                            )::numeric / COUNT(assignment_id)) * 100, 2)
                        ELSE 0 
                    END,
                    'bookmarks_added', (
                        SELECT COUNT(*) 
                        FROM bookmark 
                        WHERE user_sys_id = student_assignments.user_sys_id 
                            AND TO_CHAR(saved_at, 'YYYY-MM') = $2
                    )
                ) as overview_data
            FROM student_assignments
            GROUP BY user_sys_id
        ),

        student_sections AS (
            SELECT 
                user_sys_id,
                jsonb_agg(
                    jsonb_build_object(
                        'section_id', section_id,
                        'subject_name', subject_name,
                        'assignment', assignments_json
                    )
                ) as sections_data
            FROM (
                SELECT 
                    user_sys_id,
                    section_id,
                    subject_name,
                    jsonb_agg(
                        jsonb_build_object(
                            'assignment_id', assignment_id,
                            'title', title,
                            'due_date', due_date,
                            'status', CASE 
                                WHEN submitted_at IS NULL AND due_date < NOW() THEN 'missing'
                                WHEN submitted_at IS NULL THEN 'pending'
                                WHEN submitted_at <= due_date THEN 'on_time'
                                ELSE 'late'
                            END,
                            'score', COALESCE(score, 0)
                        )
                    ) as assignments_json
                FROM student_assignments
                GROUP BY user_sys_id, section_id, subject_name
            ) sub
            GROUP BY user_sys_id
        )

        SELECT 
            si.user_sys_id,
            'STUDENT' as role_type,
            jsonb_build_object(
                'overview', COALESCE(so.overview_data, 
                    jsonb_build_object(
                        'total_assignments', 0, 
                        'on_time_total', 0, 
                        'late_total', 0, 
                        'missing_total', 0, 
                        'on_time_rate', 0, 
                        'bookmarks_added', 0
                    )
                ),
                'section', COALESCE(ss.sections_data, '[]'::jsonb)
            ) as payload
        FROM student_info si
        LEFT JOIN student_overview so 
            ON si.user_sys_id = so.user_sys_id
        LEFT JOIN student_sections ss 
            ON si.user_sys_id = ss.user_sys_id;
    `

    return await queryRunner.query(query, [inst_id, report_month]);
}
