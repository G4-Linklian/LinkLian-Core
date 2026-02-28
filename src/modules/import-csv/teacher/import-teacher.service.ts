import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { parseExcelFile } from '../shared/utils/excel.util';
import { ImportTeacherDto } from './dto/import-teacher.dto';
import { UserSys } from '../../users/entities/user-sys.entity';
import { LearningArea } from '../../learning-area/entities/learning-area.entity';
import {
  generateInitialPassword,
  hashPassword,
} from '../../../common/utils/auth.util';
import { sendInitialPasswordEmail } from '../../../common/utils/mailer.utils';
import { JwtService } from '@nestjs/jwt';
import {
  ValidatedRow,
  calculateDataHash,
  chunkArray,
  processBatchesParallel,
  createValidationToken,
  IMPORT_BATCH_SIZE,
  IMPORT_MAX_CONCURRENT_BATCHES,
  USER_STATUS_MAP,
} from '../shared';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class ImportTeacherService {
  constructor(
    @InjectRepository(UserSys)
    private userSysRepo: Repository<UserSys>,
    @InjectRepository(LearningArea)
    private learningAreaRepo: Repository<LearningArea>,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private readonly logger: AppLogger,
  ) {}

  private async validateBatch(
    batch: { index: number; row: any }[],
    learningAreas: LearningArea[],
    instId: number,
    existingEmails: Set<string>,
    existingCodes: Set<string>,
    firstOccurrences: { email: Map<string, number>; code: Map<string, number> },
  ): Promise<ValidatedRow[]> {
    const results: ValidatedRow[] = [];

    for (const { index, row } of batch) {
      const rowNumber = index + 2;
      const dto = plainToInstance(ImportTeacherDto, row);
      const errorMessages: string[] = [];
      const warningMessages: string[] = [];
      let isDuplicate = false;

      const rowErrors = await validate(dto);
      if (rowErrors.length > 0) {
        errorMessages.push(
          ...rowErrors.map((e) =>
            Object.values(e.constraints || {}).join(', '),
          ),
        );
      }

      const la = learningAreas.find(
        (l) =>
          l.learning_area_name.toLowerCase() ===
          dto.learningArea?.toLowerCase(),
      );
      if (!la && dto.learningArea) {
        errorMessages.push(
          `กลุ่มการเรียนรู้ "${dto.learningArea}" ไม่มีในระบบ`,
        );
      }

      if (dto.teacherEmail) {
        const emailLower = dto.teacherEmail.toLowerCase();
        if (existingEmails.has(emailLower)) {
          warningMessages.push(
            `อีเมล ${dto.teacherEmail} มีอยู่ในระบบแล้ว (จะข้ามการบันทึก)`,
          );
          isDuplicate = true;
        } else if (firstOccurrences.email.get(emailLower) !== index) {
          errorMessages.push(`อีเมล ${dto.teacherEmail} ซ้ำกันภายในไฟล์`);
        }
      }

      if (dto.teacherId) {
        if (existingCodes.has(dto.teacherId)) {
          warningMessages.push(
            `รหัสบุคลากร ${dto.teacherId} มีอยู่ในระบบแล้ว (จะข้ามการบันทึก)`,
          );
          isDuplicate = true;
        } else if (firstOccurrences.code.get(dto.teacherId) !== index) {
          errorMessages.push(`รหัสบุคลากร ${dto.teacherId} ซ้ำกันภายในไฟล์`);
        }
      }

      results.push({
        row: rowNumber,
        data: row,
        isValid: errorMessages.length === 0,
        errors: errorMessages,
        warnings: warningMessages,
        isDuplicate,
      });
    }
    return results;
  }

  async validateTeacherData(instId: number, instType: string, buffer: Buffer) {
    const rawData = await parseExcelFile(buffer);

    const [learningAreas, existingUsers] = await Promise.all([
      this.learningAreaRepo.find({
        where: { inst_id: instId, flag_valid: true },
      }),
      this.userSysRepo.find({
        where: { inst_id: instId },
        select: ['email', 'code'],
      }),
    ]);

    const existingEmails = new Set(
      existingUsers
        .map((u) => u.email?.toLowerCase())
        .filter((e): e is string => !!e),
    );
    const existingCodes = new Set(
      existingUsers.map((u) => u.code).filter((c): c is string => !!c),
    );

    const firstOccurrences = {
      email: new Map<string, number>(),
      code: new Map<string, number>(),
    };
    rawData.forEach((row, index) => {
      const dto = plainToInstance(ImportTeacherDto, row);
      const email = dto.teacherEmail?.toLowerCase();
      if (email && !firstOccurrences.email.has(email))
        firstOccurrences.email.set(email, index);
      if (dto.teacherId && !firstOccurrences.code.has(dto.teacherId))
        firstOccurrences.code.set(dto.teacherId, index);
    });

    const batches = chunkArray(
      rawData.map((row, index) => ({ index, row })),
      IMPORT_BATCH_SIZE,
    );
    const validatedData = await processBatchesParallel(
      batches,
      (batch) =>
        this.validateBatch(
          batch,
          learningAreas,
          instId,
          existingEmails,
          existingCodes,
          firstOccurrences,
        ),
      IMPORT_MAX_CONCURRENT_BATCHES,
    );

    validatedData.sort((a, b) => a.row - b.row);

    const validCount = validatedData.filter(
      (v) => v.isValid && !v.isDuplicate,
    ).length;
    const duplicateCount = validatedData.filter((v) => v.isDuplicate).length;
    const errorCount = validatedData.filter(
      (v) => !v.isValid && !v.isDuplicate,
    ).length;
    const warningCount = validatedData.filter(
      (v) => v.warnings.length > 0,
    ).length;
    const willSaveCount = Math.max(0, validCount);

    const validationToken =
      errorCount === 0 && validCount > 0
        ? createValidationToken(this.jwtService, {
            instId,
            dataHash: calculateDataHash(rawData),
            validCount,
            duplicateCount,
            type: 'teacher',
          })
        : null;

    const results = {
      validatedData,
      summary: {
        total: rawData.length,
        validCount,
        errorCount,
        duplicateCount,
        warningCount,
        willSaveCount,
      },
    };

    return {
      success: true,
      data: results,
      validationToken,
    };
  }

  private async saveBatch(
    batch: any[],
    queryRunner: any,
    learningAreas: LearningArea[],
    instId: number,
    roleId: number,
    statusMap: { [key: string]: string },
    existingEmails: Set<string>,
    existingCodes: Set<string>,
  ): Promise<{
    savedCount: number;
    skippedCount: number;
    passwordMap: Map<string, string>;
  }> {
    let savedCount = 0;
    let skippedCount = 0;
    const passwordMap = new Map<string, string>();

    for (const row of batch) {
      const teacherDto = plainToInstance(ImportTeacherDto, row);

      const emailLower = teacherDto.teacherEmail?.toLowerCase();
      if (
        (emailLower && existingEmails.has(emailLower)) ||
        (teacherDto.teacherId && existingCodes.has(teacherDto.teacherId))
      ) {
        skippedCount++;
        continue;
      }

      const learningArea = learningAreas.find(
        (la) =>
          la.learning_area_name.toLowerCase() ===
          teacherDto.learningArea?.toLowerCase(),
      );
      if (!learningArea) {
        throw new NotFoundException(
          `กลุ่มการเรียนรู้ "${teacherDto.learningArea}" ไม่พบในระบบ`,
        );
      }

      const initialPassword = generateInitialPassword();
      const hashedPassword = await hashPassword(initialPassword);
      passwordMap.set(teacherDto.teacherEmail || '', initialPassword);

      const rawStatus =
        teacherDto.teacherStatus?.trim().toLowerCase() || 'active';
      const mappedStatus = statusMap[rawStatus] || 'Active';

      const insertUserQuery = `
                INSERT INTO user_sys 
                (email, password, first_name, last_name, phone, role_id, code, inst_id, user_status, flag_valid, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                RETURNING user_sys_id
            `;

      const userValues = [
        teacherDto.teacherEmail,
        hashedPassword,
        teacherDto.teacherName,
        teacherDto.teacherLastName,
        teacherDto.teacherPhone || null,
        roleId,
        teacherDto.teacherId,
        instId,
        mappedStatus,
        true,
      ];

      const result = await queryRunner.manager.query(
        insertUserQuery,
        userValues,
      );
      const userSysId = result[0].user_sys_id;

      const insertLearningAreaNormalizeQuery = `
                INSERT INTO user_sys_learning_area_normalize
                (user_sys_id, learning_area_id, flag_valid)
                VALUES ($1, $2, true)
            `;
      await queryRunner.manager.query(insertLearningAreaNormalizeQuery, [
        userSysId,
        learningArea.learning_area_id,
      ]);

      if (emailLower) existingEmails.add(emailLower);
      if (teacherDto.teacherId) existingCodes.add(teacherDto.teacherId);

      savedCount++;
    }

    return { savedCount, skippedCount, passwordMap };
  }

  async saveTeacherData(
    instId: number,
    instType: string,
    buffer: Buffer,
    validationToken?: string,
  ) {
    if (!validationToken) {
      throw new BadRequestException(
        'กรุณา validate ข้อมูลก่อนบันทึก (ต้องระบุ validationToken)',
      );
    }

    const rawData = await parseExcelFile(buffer);

    const isSchool = instType === 'school';
    const isUniversity = instType === 'university' || instType === 'uni';
    if (!isSchool && !isUniversity) {
      throw new BadRequestException(`ประเภทสถาบัน "${instType}" ไม่รองรับ`);
    }

    // const payload = verifyValidationToken(
    //   this.jwtService,
    //   validationToken,
    //   'teacher',
    //   instId,
    //   rawData,
    // );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let totalSavedCount = 0;
    let totalSkippedCount = 0;
    const allPasswordMap = new Map<string, string>();

    const roleId = isSchool ? 4 : 5;

    try {
      const [learningAreas, existingUsers] = await Promise.all([
        this.learningAreaRepo.find({
          where: { inst_id: instId, flag_valid: true },
        }),
        this.userSysRepo.find({
          where: { inst_id: instId },
          select: ['email', 'code'],
        }),
      ]);

      const existingEmails = new Set<string>(
        existingUsers
          .map((u) => u.email?.toLowerCase())
          .filter((email): email is string => !!email),
      );
      const existingCodes = new Set<string>(
        existingUsers
          .map((u) => u.code)
          .filter((code): code is string => !!code),
      );

      const batches = chunkArray(rawData, IMPORT_BATCH_SIZE);

      for (let i = 0; i < batches.length; i++) {
        const { savedCount, skippedCount, passwordMap } = await this.saveBatch(
          batches[i],
          queryRunner,
          learningAreas,
          instId,
          roleId,
          USER_STATUS_MAP,
          existingEmails,
          existingCodes,
        );
        totalSavedCount += savedCount;
        totalSkippedCount += skippedCount;
        passwordMap.forEach((v, k) => allPasswordMap.set(k, v));
      }

      await queryRunner.commitTransaction();

      const emailBatches = chunkArray(Array.from(allPasswordMap.entries()), 10);
      for (const emailBatch of emailBatches) {
        await Promise.all(
          emailBatch.map(([email, password]) =>
            sendInitialPasswordEmail(email, password).catch((err) => {
              this.logger.error(
                `Error sending password email to ${email}:`,
                'SaveTeacherData',
                err,
              );
            }),
          ),
        );
      }

      const result = {
        count: totalSavedCount,
        skippedCount: totalSkippedCount,
        skippedReason: totalSkippedCount > 0 ? 'ข้อมูลซ้ำในระบบ' : null,
      };

      return {
        success: true,
        message: `นำเข้าข้อมูลบุคลากรสำเร็จ ${totalSavedCount} รายการ`,
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
