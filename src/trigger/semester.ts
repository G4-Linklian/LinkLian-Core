import { logger, schedules } from "@trigger.dev/sdk/v3";
import { DataSource, QueryRunner } from 'typeorm';
import { triggerDataSourceOptions } from "./trigger-db";
import { AppLogger } from 'src/common/logger/app-logger.service';

const applogger = new AppLogger();


const dataSource = new DataSource(triggerDataSourceOptions);

export const semesterTask = schedules.task({
  id: "semester-task",
  // Every day at 4 AM (Thailand time, UTC+7) = 21:00 UTC
  cron: "0 21 * * *",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 3500,
  run: async () => {
    const dateNow = new Date();

    const thaiDate = new Date(
      dateNow.toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
    );

    const semesterData = await getSemesterBetweenData(thaiDate);

    logger.log("Semester task", { semesterData });
    applogger.log("Semester task", "semesterTask", semesterData);

    if (semesterData.length === 0) {
      logger.log("No active semester found for current date", { thaiDate });
      applogger.log("No active semester found for current date", "semesterTask", { thaiDate });
      return;
    }

    for (const data of semesterData) {

      const { semester_id, inst_id } = data;

      await processSemesterWithTransaction(inst_id, semester_id);

    }

  },
});

async function ensureDataSourceInitialized() {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
}

async function processSemesterWithTransaction(inst_id: number, semester_id: number) {
  await ensureDataSourceInitialized();

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();

    // check for this semester have open semester before
    const openedSemester = await getSemesterOpened(inst_id, semester_id, queryRunner);

    if (openedSemester.length > 0) {
      logger.warn("Found opened semester for institution", { inst_id, openedSemester });
      applogger.warn("Found opened semester for institution", "semesterTask", { inst_id, openedSemester });

      // set this semester to close
      await updateSemesterClosed(semester_id, queryRunner);

      logger.log("Updated semester to closed", { semester_id });
      applogger.log("Updated semester to closed", "semesterTask", { semester_id });

      // Handle Student Up Edu Level
      await updateStudentUpEduLevel(inst_id, queryRunner);

      logger.log("Updated student edu level up", { inst_id });
      applogger.log("Updated student edu level up", "semesterTask", { inst_id });

      // Handle Student Graduate
      await updateStudentGraduate(inst_id, queryRunner);

      logger.log("Updated student graduate", { inst_id });
      applogger.log("Updated student graduate", "semesterTask", { inst_id });

      // set this semester to open
      await updateSemesterOpen(semester_id, queryRunner);

      logger.log("Updated semester to open", { semester_id });
      applogger.log("Updated semester to open", "semesterTask", { semester_id });

    } else {
      logger.log("No opened semester found for institution", { inst_id });
      applogger.log("No opened semester found for institution", "semesterTask", { inst_id });

      // set this semester to open
      await updateSemesterOpen(semester_id, queryRunner);

      logger.log("Updated semester to open", { semester_id });
      applogger.log("Updated semester to open", "semesterTask", { semester_id });
    }

    await queryRunner.commitTransaction();
  } catch (error) {
    await queryRunner.rollbackTransaction();

    logger.error("Failed processing semester transaction. Rolled back.", {
      inst_id,
      semester_id,
      error,
    });
    applogger.error("Failed processing semester transaction. Rolled back.", "semesterTask", {
      inst_id,
      semester_id,
      error,
    });

    throw error;
  } finally {
    await queryRunner.release();
  }
}

export async function getSemesterBetweenData(targetDate: Date) {
  await ensureDataSourceInitialized();

  const queryRunner = dataSource.createQueryRunner();

  await queryRunner.connect();

  const query = `
        SELECT * FROM semester s
        WHERE s.start_date <= $1::timestamp AND s.end_date >= $1::timestamp
    `

  try {
    return await queryRunner.query(query, [targetDate]);
  } finally {
    await queryRunner.release();
  }

}

export async function getSemesterOpened(inst_id: number, semester_id: number, existingQueryRunner?: QueryRunner) {
  await ensureDataSourceInitialized();

  const queryRunner = existingQueryRunner ?? dataSource.createQueryRunner();

  if (!existingQueryRunner) {
    await queryRunner.connect();
  }

  const query = `
        SELECT * FROM semester s
        WHERE s.inst_id = $1 AND s.semester_id != $2 AND s.status = 'open'
    `

  try {
    return await queryRunner.query(query, [inst_id, semester_id]);
  } finally {
    if (!existingQueryRunner) {
      await queryRunner.release();
    }
  }

}

export async function updateSemesterClosed(semester_id: number, existingQueryRunner?: QueryRunner) {
  await ensureDataSourceInitialized();

  const queryRunner = existingQueryRunner ?? dataSource.createQueryRunner();

  if (!existingQueryRunner) {
    await queryRunner.connect();
  }

  const query = `
        UPDATE semester SET status = 'closed'
        WHERE semester_id = $1
    `

  try {
    return await queryRunner.query(query, [semester_id]);
  } finally {
    if (!existingQueryRunner) {
      await queryRunner.release();
    }
  }

}

export async function updateSemesterOpen(semester_id: number, existingQueryRunner?: QueryRunner) {
  await ensureDataSourceInitialized();

  const queryRunner = existingQueryRunner ?? dataSource.createQueryRunner();

  if (!existingQueryRunner) {
    await queryRunner.connect();
  }

  const query = `
        UPDATE semester SET status = 'open'
        WHERE semester_id = $1
    `

  try {
    return await queryRunner.query(query, [semester_id]);
  } finally {
    if (!existingQueryRunner) {
      await queryRunner.release();
    }
  }

}

export async function getUserStudy(inst_id: number, existingQueryRunner?: QueryRunner) {
  await ensureDataSourceInitialized();

  const queryRunner = existingQueryRunner ?? dataSource.createQueryRunner();

  if (!existingQueryRunner) {
    await queryRunner.connect();
  }

  const query = `
        SELECT * FROM user_sys us
        LEFT JOIN edu_level el ON us.edu_lev_id = el.edu_lev_id
        WHERE us.inst_id = $1 AND us.edu_lev_id IS NOT NULL AND el.edu_lev_id NOT IN (6, 10, 14, 18)
    `

  try {
    return await queryRunner.query(query, [inst_id]);
  } finally {
    if (!existingQueryRunner) {
      await queryRunner.release();
    }
  }

}

export async function updateStudentUpEduLevel(inst_id: number, existingQueryRunner?: QueryRunner) {
  await ensureDataSourceInitialized();

  const queryRunner = existingQueryRunner ?? dataSource.createQueryRunner();

  if (!existingQueryRunner) {
    await queryRunner.connect();
  }

  const query = `
        UPDATE user_sys
        SET edu_lev_id = edu_lev_id + 1
        WHERE user_sys_id IN (
            SELECT us.user_sys_id
            FROM user_sys us
            LEFT JOIN edu_level el 
                ON us.edu_lev_id = el.edu_lev_id
            WHERE us.inst_id = $1 
              AND us.edu_lev_id IS NOT NULL 
              AND el.edu_lev_id NOT IN (6, 10, 14, 18)
        );
    `

  try {
    return await queryRunner.query(query, [inst_id]);
  } finally {
    if (!existingQueryRunner) {
      await queryRunner.release();
    }
  }

}

export async function getUserGraduate(inst_id: number, existingQueryRunner?: QueryRunner) {
  await ensureDataSourceInitialized();

  const queryRunner = existingQueryRunner ?? dataSource.createQueryRunner();

  if (!existingQueryRunner) {
    await queryRunner.connect();
  }

  const query = `
        SELECT * FROM user_sys us
        LEFT JOIN edu_level el ON us.edu_lev_id = el.edu_lev_id
        WHERE us.inst_id = $1 AND us.edu_lev_id IS NOT NULL AND el.edu_lev_id IN (6, 10, 14, 18)
    `

  try {
    return await queryRunner.query(query, [inst_id]);
  } finally {
    if (!existingQueryRunner) {
      await queryRunner.release();
    }
  }

}


export async function updateStudentGraduate(inst_id: number, existingQueryRunner?: QueryRunner) {
  await ensureDataSourceInitialized();

  const queryRunner = existingQueryRunner ?? dataSource.createQueryRunner();

  if (!existingQueryRunner) {
    await queryRunner.connect();
  }

  const query = `
        UPDATE user_sys
        SET user_status = 'Graduated'
        WHERE user_sys_id IN (
            SELECT us.user_sys_id
            FROM user_sys us
            LEFT JOIN edu_level el 
                ON us.edu_lev_id = el.edu_lev_id
            WHERE us.inst_id = $1 
              AND us.edu_lev_id IS NOT NULL 
              AND el.edu_lev_id IN (6, 10, 14, 18)
        );
    `

  try {
    return await queryRunner.query(query, [inst_id]);
  } finally {
    if (!existingQueryRunner) {
      await queryRunner.release();
    }
  }

}