import { logger, schedules } from "@trigger.dev/sdk/v3";
import { DataSource, DataSourceOptions } from 'typeorm';
import { triggerDataSourceOptions } from "./trigger-db";
import { AppLogger } from 'src/common/logger/app-logger.service';

const applogger = new AppLogger();


const dataSource = new DataSource(triggerDataSourceOptions);

export const deadlineProcessTask = schedules.task({
  id: "deadline-process-task",
  // Every day at 3 AM (Thailand time, UTC+7) = 20:00 UTC
  cron: "0 20 * * *",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 3500,
  run: async (payload, { ctx }) => {
    const now = new Date();

    // change to Thai time
    const thaiNow = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );

    // +1 day in Thai time
    const thaiPlusOneDay = new Date(thaiNow);
    thaiPlusOneDay.setDate(thaiPlusOneDay.getDate() + 1);

    const deadlineData = await getAssignmentDeadline(thaiPlusOneDay);

    logger.log("Deadline process task", { deadlineData });
    applogger.log("Deadline process task", "deadlineProcessTask", deadlineData);

    for (const data of deadlineData) {

      const { due_date, is_group, user_sys_id, section_id, title, content, section_name, subject_code, name_th } = data;

      const messageTitle = `คุณส่งการบ้านวิชา ${name_th} (${subject_code}) ที่คลาส ${section_name} แล้วหรือยัง`;
      const messageContent = `การบ้านที่มีชื่อว่า ${title} \n รายละเอียด: ${content} \n มีกำหนดส่งในวันที่ ${due_date.toLocaleDateString()} เวลา ${due_date.toLocaleTimeString()}. \n กรุณาตรวจสอบและส่งการบ้านให้ทันเวลานะครับ.`;

      logger.log("Assignment due", { messageTitle, messageContent });
      applogger.log("Assignment due", "assignmentDue",
        {
          messageTitle,
          messageContent,
          user_sys_id,
        }
      );

    }
  },
});

export async function getAssignmentDeadline(targetDate: Date) {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const queryRunner = dataSource.createQueryRunner();

  await queryRunner.connect();

  const query = `
        SELECT a.due_date, a.is_group, gm.*, pic.section_id, pc.title, pc.content, s.section_name, sj.subject_code, sj.name_th FROM assignment a
        LEFT JOIN student_group sg ON a.assignment_id = sg.assignment_id
        LEFT JOIN group_member gm ON sg.group_id = gm.group_id
        LEFT JOIN post_in_class pic ON a.post_id = pic.post_id
        LEFT JOIN post_content pc ON pc.post_content_id = pic.post_content_id
        LEFT JOIN section s ON pic.section_id = s.section_id
        LEFT JOIN subject sj ON s.subject_id = sj.subject_id
        WHERE a.due_date = $1::timestamp
    `

  try {
    return await queryRunner.query(query, [targetDate]);
  } finally {
    await queryRunner.release();
  }

}