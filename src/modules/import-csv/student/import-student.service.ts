import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { parseExcelFile } from '../shared/utils/excel.util';
import { ImportSchoolStudentDto, ImportUniStudentDto, ImportStudentDto } from './dto/import-student.dto';
import { UserSys } from '../../users/entities/user-sys.entity';
import { EduLevel } from '../../edu-level/entities/edu-level.entity';
import { Program, ProgramType } from '../../program/entities/program.entity';
import { generateInitialPassword, hashPassword } from '../../../common/utils/auth.util';
import { sendInitialPasswordEmail } from '../../../common/utils/mailer.utils';
import { JwtService } from '@nestjs/jwt';
import {
    ValidatedRow,
    calculateDataHash,
    chunkArray,
    processBatchesParallel,
    createValidationToken,
    verifyValidationToken,
    IMPORT_BATCH_SIZE,
    IMPORT_MAX_CONCURRENT_BATCHES,
    USER_STATUS_MAP
} from '../shared';

// Helper type for student DTO
type StudentDtoType = ImportSchoolStudentDto | ImportUniStudentDto;
type StudentDtoClass = typeof ImportSchoolStudentDto | typeof ImportUniStudentDto;

@Injectable()
export class ImportStudentService {
    constructor(
        @InjectRepository(UserSys)
        private userSysRepo: Repository<UserSys>,
        @InjectRepository(EduLevel)
        private eduLevelRepo: Repository<EduLevel>,
        @InjectRepository(Program)
        private programRepo: Repository<Program>,
        private dataSource: DataSource,
        private jwtService: JwtService
    ) { }

    private getDtoClass(instType: string): typeof ImportSchoolStudentDto | typeof ImportUniStudentDto {
        const isSchool = instType === 'school';
        return isSchool ? ImportSchoolStudentDto : ImportUniStudentDto;
    }

    private getParentProgramName(dto: StudentDtoType, instType: string): string | undefined {
        if (instType === 'school') {
            return (dto as ImportSchoolStudentDto).studyPlan;
        } else {
            return (dto as ImportUniStudentDto).major;
        }
    }

    private getClassroomName(dto: StudentDtoType, instType: string): string | undefined {
        if (instType === 'school') {
            return (dto as ImportSchoolStudentDto).classroom;
        } else {
            return (dto as ImportUniStudentDto).major;
        }
    }

    private async validateBatch(
        batch: { index: number; row: any }[],
        eduLevels: EduLevel[],
        programs: Program[],
        instId: number,
        instType: string,
        existingEmails: Set<string>,
        existingCodes: Set<string>,
        firstOccurrences: { email: Map<string, number>; code: Map<string, number> }
    ): Promise<ValidatedRow[]> {
        const results: ValidatedRow[] = [];
        const DtoClass = this.getDtoClass(instType);
        const isSchool = instType === 'school';

        for (const { index, row } of batch) {
            const rowNumber = index + 2;
            const studentDto = plainToInstance(DtoClass as any, row, { excludeExtraneousValues: true }) as unknown as StudentDtoType;
            const errorMessages: string[] = [];
            const warningMessages: string[] = [];
            let isDuplicate = false;

            // DTO Validation
            const rowErrors = await validate(studentDto);
            if (rowErrors.length > 0) {
                errorMessages.push(...rowErrors.map(e => Object.values(e.constraints || {}).join(', ')));
            }

            const eduLevel = eduLevels.find(el => el.level_name === studentDto.eduLevel);
            if (!eduLevel) {
                errorMessages.push(`ระดับชั้นที่ระบุไม่ถูกต้อง: ${studentDto.eduLevel}`);
            }

            // Classroom & Program 
            const classroomName = this.getClassroomName(studentDto, instType);
            const parentProgramName = this.getParentProgramName(studentDto, instType);
            const possibleClassrooms = programs.filter(p => p.program_name === classroomName && p.program_type === ProgramType.CLASS && p.flag_valid);

            let classroom: Program | undefined;
            if (possibleClassrooms.length > 0 && parentProgramName) {
                classroom = possibleClassrooms.find(c => programs.some(p => 
                    Number(p.program_id) === Number(c.parent_id) && 
                    p.program_name.trim() === parentProgramName.trim() &&
                    p.program_type === (isSchool ? ProgramType.STUDY_PLAN : ProgramType.MAJOR) &&
                    p.flag_valid
                ));
            }

            if (possibleClassrooms.length === 0) {
                errorMessages.push(`ห้องเรียนที่ระบุไม่ถูกต้อง: ${classroomName}`);
            } else if (!classroom) {
                errorMessages.push(`ห้องเรียน "${classroomName}" ไม่สอดคล้องกับ${isSchool ? 'แผนการเรียน' : 'สาขา'} "${parentProgramName}"`);
            }

            // Check EduLevel - Program
            // if (classroom && eduLevel) {
            //     const eduLevelProgram = await this.dataSource.getRepository('EduLevelProgramNormalize').findOne({
            //         where: { edu_lev_id: eduLevel.edu_lev_id, program_id: classroom.program_id, flag_valid: true }
            //     });
            //     if (!eduLevelProgram) {
            //         errorMessages.push(`ระดับชั้น "${studentDto.eduLevel}" ไม่สอดคล้องกับห้องเรียน "${classroomName}"`);
            //     }
            // }

            // Duplicate Check Email
            if (studentDto.studentEmail) {
                const emailLower = studentDto.studentEmail.toLowerCase();
                if (existingEmails.has(emailLower)) {
                    warningMessages.push(`อีเมล ${studentDto.studentEmail} มีอยู่ในระบบแล้ว (จะข้ามการบันทึก)`);
                    isDuplicate = true;
                } else if (firstOccurrences.email.get(emailLower) !== index) {
                    errorMessages.push(`อีเมล ${studentDto.studentEmail} ซ้ำกันภายในไฟล์`);
                }
            }

            // Duplicate Check Student Code
            if (studentDto.studentId) {
                if (existingCodes.has(studentDto.studentId)) {
                    warningMessages.push(`รหัสนักเรียน ${studentDto.studentId} มีอยู่ในระบบแล้ว (จะข้ามการบันทึก)`);
                    isDuplicate = true;
                } else if (firstOccurrences.code.get(studentDto.studentId) !== index) {
                    errorMessages.push(`รหัสนักเรียน ${studentDto.studentId} ซ้ำกันภายในไฟล์`);
                }
            }

            results.push({
                row: rowNumber,
                data: row,
                isValid: errorMessages.length === 0,
                errors: errorMessages,
                warnings: warningMessages,
                isDuplicate
            });
        }
        return results;
    }

    async validateStudentData(instId: number, instType: string, buffer: Buffer) {
        const rawData = await parseExcelFile(buffer);
        const DtoClass = this.getDtoClass(instType);

        // Pre-fetch ข้อมูลระบบ
        const [eduLevels, programs, existingUsers] = await Promise.all([
            this.eduLevelRepo.find(),
            this.programRepo.find({ where: { inst_id: instId } }),
            this.userSysRepo.find({ where: { inst_id: instId }, select: ['email', 'code'] })
        ]);

        const existingEmails = new Set(existingUsers.map(u => u.email?.toLowerCase()).filter((e): e is string => !!e));
        const existingCodes = new Set(existingUsers.map(u => u.code).filter((c): c is string => !!c));

        const firstOccurrences = {
            email: new Map<string, number>(),
            code: new Map<string, number>()
        };
        rawData.forEach((row, index) => {
            const studentDto = plainToInstance(DtoClass as any, row, { excludeExtraneousValues: true }) as unknown as StudentDtoType;
            const email = studentDto.studentEmail?.toLowerCase();
            if (email && !firstOccurrences.email.has(email)) firstOccurrences.email.set(email, index);
            if (studentDto.studentId && !firstOccurrences.code.has(studentDto.studentId)) firstOccurrences.code.set(studentDto.studentId, index);
        });

        const indexedData = rawData.map((row, index) => ({ index, row }));
        const batches = chunkArray(indexedData, IMPORT_BATCH_SIZE);

        const validatedData = await processBatchesParallel(
            batches,
            (batch) => this.validateBatch(batch, eduLevels, programs, instId, instType, existingEmails, existingCodes, firstOccurrences),
            IMPORT_MAX_CONCURRENT_BATCHES
        );

        validatedData.sort((a, b) => a.row - b.row);

        const validCount = validatedData.filter(v => v.isValid).length;
        const errorCount = validatedData.filter(v => !v.isValid).length;
        const duplicateCount = validatedData.filter(v => v.isDuplicate).length;
        const warningCount = validatedData.filter(v => v.warnings.length > 0).length;

        const validationToken = (errorCount === 0 && validCount > 0)
            ? createValidationToken(this.jwtService, { instId, dataHash: calculateDataHash(rawData), validCount, duplicateCount, type: 'student' })
            : null;

        const result = {
            validatedData,
            summary: {
                total: rawData.length,
                validCount,
                errorCount,
                duplicateCount,  
                warningCount,    
                willSaveCount: validCount - duplicateCount 
            }
        }

        return {
            success: true,
            data: result,
            validationToken
        };
    }

    private async saveBatch(
        batch: any[],
        queryRunner: any,
        eduLevels: EduLevel[],
        programs: Program[],
        instId: number,
        instType: string,
        roleId: number,
        statusMap: { [key: string]: string },
        existingEmails: Set<string>, 
        existingCodes: Set<string>    
    ): Promise<{ savedCount: number; skippedCount: number; passwordMap: Map<string, string> }> {
        let savedCount = 0;
        let skippedCount = 0; 
        const passwordMap = new Map<string, string>();
        const DtoClass = this.getDtoClass(instType);
        const isSchool = instType === 'school';

        for (const row of batch) {
            const studentDto = plainToInstance(DtoClass as any, row, { excludeExtraneousValues: true }) as unknown as StudentDtoType;

            // ข้าม duplicate
            const emailLower = studentDto.studentEmail?.toLowerCase();
            if ((emailLower && existingEmails.has(emailLower)) || 
                (studentDto.studentId && existingCodes.has(studentDto.studentId))) {
                console.log(`[INFO] Skipping duplicate: ${studentDto.studentEmail || studentDto.studentId}`);
                skippedCount++;
                continue;
            }

            const eduLevel = eduLevels.find(el => el.level_name === studentDto.eduLevel);
            if (!eduLevel) {
                throw new NotFoundException(`ระดับชั้น ${studentDto.eduLevel} ไม่พบในระบบ`);
            }

            // หา classroom name และ parent program name ตาม instType
            const classroomName = this.getClassroomName(studentDto, instType);
            const parentProgramName = this.getParentProgramName(studentDto, instType);

            const possibleClassrooms = programs.filter(
                p => p.program_name === classroomName &&
                    p.program_type === ProgramType.CLASS &&
                    p.flag_valid === true
            );

            let classroom: Program | undefined;

            if (possibleClassrooms.length > 0 && parentProgramName) {
                classroom = possibleClassrooms.find(c => {
                    const parent = programs.find(
                        p => Number(p.program_id) === Number(c.parent_id) &&
                            p.program_name.trim() === parentProgramName.trim() &&
                            (p.program_type === (isSchool ? ProgramType.STUDY_PLAN : ProgramType.MAJOR)) &&
                            p.flag_valid === true
                    );
                    return !!parent;
                });
            }

            if (!classroom) {
                const parentLabel = isSchool ? 'แผนการเรียน' : 'สาขา';
                throw new NotFoundException(
                    `ห้องเรียน "${classroomName}" ไม่พบใน${parentLabel} "${parentProgramName}"`
                );
            }

            const initialPassword = generateInitialPassword();
            const hashedPassword = await hashPassword(initialPassword);
            passwordMap.set(studentDto.studentEmail || '', initialPassword);

            const rawStatus = studentDto.studentStatus?.trim().toLowerCase() || 'active';
            const mappedStatus = statusMap[rawStatus] || 'Active';

            const insertQuery = `
                INSERT INTO user_sys 
                (email, password, first_name, last_name, phone, role_id, code, edu_lev_id, inst_id, user_status, flag_valid, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
                RETURNING user_sys_id
            `;

            const values = [
                studentDto.studentEmail,
                hashedPassword,
                studentDto.studentName,
                studentDto.studentLastName,
                studentDto.studentPhone || null,
                roleId,
                studentDto.studentId,
                eduLevel.edu_lev_id,
                instId,
                mappedStatus,
                true
            ];

            const result = await queryRunner.manager.query(insertQuery, values);
            const userSysId = result[0].user_sys_id;

            const studentProgramQuery = `
                INSERT INTO user_sys_program_normalize
                (user_sys_id, program_id, flag_valid)
                VALUES ($1, $2, true)
            `;
            await queryRunner.manager.query(studentProgramQuery, [userSysId, classroom.program_id]);

            if (emailLower) existingEmails.add(emailLower);
            if (studentDto.studentId) existingCodes.add(studentDto.studentId);

            savedCount++;
        }

        return { savedCount, skippedCount, passwordMap };
    }

    async saveStudentData(instId: number, instType: string, buffer: Buffer, validationToken?: string) {
        if (!validationToken) {
            throw new BadRequestException('กรุณา validate ข้อมูลก่อนบันทึก (ต้องระบุ validationToken)');
        }

        // Validate instType
        const isSchool = instType === 'school';
        const isUniversity = instType === 'university' || instType === 'uni';
        if (!isSchool && !isUniversity) {
            throw new BadRequestException(`ประเภทสถาบัน "${instType}" ไม่รองรับ`);
        }

        const rawData = await parseExcelFile(buffer);

        const payload = verifyValidationToken(
            this.jwtService,
            validationToken,
            'student',
            instId,
            rawData
        );

        console.log(`[INFO] Valid token - proceeding to save ${payload.validCount} records (${payload.duplicateCount || 0} duplicates will be skipped)`);
        console.log(`[DEBUG] Saving students for inst_id: ${instId}, inst_type: ${instType}`);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let totalSavedCount = 0;
        let totalSkippedCount = 0;
        const allPasswordMap = new Map<string, string>();

        // กำหนด roleId ตาม instType
        const roleId = isSchool ? 2 : 3;

        try {
            const [eduLevels, programs, existingUsers] = await Promise.all([
                this.eduLevelRepo.find(),
                this.programRepo.find({ where: { inst_id: instId } }),
                this.userSysRepo.find({
                    where: { inst_id: instId },
                    select: ['email', 'code']
                })
            ]);

            // สร้าง Set สำหรับเช็ค duplicate
            const existingEmails = new Set<string>(
                existingUsers.map(u => u.email?.toLowerCase()).filter((email): email is string => !!email)
            );
            const existingCodes = new Set<string>(
                existingUsers.map(u => u.code).filter((code): code is string => !!code)
            );

            const batches = chunkArray(rawData, IMPORT_BATCH_SIZE);
            console.log(`[INFO] Saving ${rawData.length} records in ${batches.length} batches`);

            for (let i = 0; i < batches.length; i++) {
                console.log(`[INFO] Processing batch ${i + 1}/${batches.length}`);
                const { savedCount, skippedCount, passwordMap } = await this.saveBatch(
                    batches[i],
                    queryRunner,
                    eduLevels,
                    programs,
                    instId,
                    instType,
                    roleId,
                    USER_STATUS_MAP,
                    existingEmails,
                    existingCodes
                );
                totalSavedCount += savedCount;
                totalSkippedCount += skippedCount;
                passwordMap.forEach((v, k) => allPasswordMap.set(k, v));
            }

            await queryRunner.commitTransaction();

            // ส่ง email แบบ batch parallel
            const emailBatches = chunkArray(Array.from(allPasswordMap.entries()), 10);
            for (const emailBatch of emailBatches) {
                await Promise.all(
                    emailBatch.map(([email, password]) =>
                        sendInitialPasswordEmail(email, password).catch(err => {
                            console.error(`Error sending password email to ${email}:`, err);
                        })
                    )
                );
            }

            const result = {
                count: totalSavedCount,
                skippedCount: totalSkippedCount, 
                skippedReason: totalSkippedCount > 0 ? 'ข้อมูลซ้ำในระบบ' : null
            }

            return {
                success: true,
                message: `นำเข้าข้อมูลนักเรียนสำเร็จ ${totalSavedCount} รายการ`,
                data: result
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }
}
