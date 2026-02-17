import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { parseExcelFile } from '../shared/utils/excel.util';
import { Subject } from '../../subject/entities/subject.entity';
import { Section } from '../../section/entities/section.entity';
import { Enrollment } from '../../section/entities/enrollment.entity';
import { UserSys } from '../../users/entities/user-sys.entity';
import { Institution } from '../../institution/entities/institution.entity';
import { ImportEnrollmentDto } from './dto/import-enrollment.dto';
import {
    ValidatedRow,
    calculateDataHash,
    chunkArray,
    processBatchesParallel,
    createValidationToken,
    verifyValidationToken,
    IMPORT_BATCH_SIZE,
    IMPORT_MAX_CONCURRENT_BATCHES
} from '../shared';

interface PreFetchedData {
    subjects: Map<string, number>; 
    sections: Map<string, number>; 
    students: Map<string, number>; 
    existingEnrollments: Set<string>;
}

@Injectable()
export class ImportEnrollmentService {
    constructor(
        @InjectRepository(Subject)
        private subjectRepository: Repository<Subject>,
        @InjectRepository(Section)
        private sectionRepository: Repository<Section>,
        @InjectRepository(Enrollment)
        private enrollmentRepository: Repository<Enrollment>,
        @InjectRepository(UserSys)
        private userRepository: Repository<UserSys>,
        @InjectRepository(Institution)
        private institutionRepository: Repository<Institution>,
        private dataSource: DataSource,
        private jwtService: JwtService
    ) {}

    private async preFetchData(instId: number): Promise<PreFetchedData> {
        const [subjects, sections, students, existingEnrollments] = await Promise.all([

            // Subjects (ผ่าน learning_area)
            this.dataSource.query(
                `SELECT s.subject_id, s.subject_code 
                 FROM subject s
                 INNER JOIN learning_area la ON s.learning_area_id = la.learning_area_id
                 WHERE la.inst_id = $1 AND s.flag_valid = true`,
                [instId]
            ) as Promise<{ subject_id: number; subject_code: string }[]>,

            // Sections (พร้อม subject_code)
            this.dataSource.query(
                `SELECT sec.section_id, sec.section_name, s.subject_code
                 FROM section sec
                 INNER JOIN subject s ON sec.subject_id = s.subject_id
                 INNER JOIN learning_area la ON s.learning_area_id = la.learning_area_id
                 WHERE la.inst_id = $1 AND sec.flag_valid = true`,
                [instId]
            ) as Promise<{ section_id: number; section_name: string; subject_code: string }[]>,

            // Students (role_id 2 = school student, 3 = university student)
            this.userRepository.find({
                where: { inst_id: instId, flag_valid: true },
                select: ['user_sys_id', 'code', 'role_id']
            }),

            // Existing enrollments
            this.dataSource.query(
                `SELECT e.section_id, e.student_id
                 FROM enrollment e
                 INNER JOIN section sec ON e.section_id = sec.section_id
                 INNER JOIN subject s ON sec.subject_id = s.subject_id
                 INNER JOIN learning_area la ON s.learning_area_id = la.learning_area_id
                 WHERE la.inst_id = $1 AND e.flag_valid = true`,
                [instId]
            ) as Promise<{ section_id: number; student_id: number }[]>
        ]);

        // Filter เฉพาะ students role_id 2 หรือ 3
        const studentUsers = students.filter(s => s.role_id === 2 || s.role_id === 3);

        const result = {
            subjects: new Map(subjects.map(s => [s.subject_code?.toLowerCase() || '', s.subject_id])),
            sections: new Map(sections.map(s => [`${s.subject_code?.toLowerCase()}|${s.section_name?.toLowerCase()}`, s.section_id])),
            students: new Map(
                studentUsers
                    .filter(s => s.code)
                    .map(s => [s.code!.toLowerCase(), s.user_sys_id] as [string, number])
            ),
            existingEnrollments: new Set(existingEnrollments.map(e => `${e.section_id}|${e.student_id}`))
        }

        return result;
    }

    private async validateBatch(
        batch: { index: number; row: any }[],
        preFetchedData: PreFetchedData,
        firstOccurrences: Map<string, number>
    ): Promise<ValidatedRow[]> {
        const results: ValidatedRow[] = [];

        for (const { index, row } of batch) {
            const rowNumber = index + 2;
            const errorMessages: string[] = [];
            const warningMessages: string[] = [];
            let isDuplicate = false;

            const dto = plainToInstance(ImportEnrollmentDto, row, { excludeExtraneousValues: true });
            const rowErrors = await validate(dto);
            if (rowErrors.length > 0) {
                errorMessages.push(...rowErrors.map(e => Object.values(e.constraints || {}).join(', ')));
            }

            const sectionKey = `${dto.subjectCode?.toLowerCase()}|${dto.section?.toLowerCase()}`;
            const studentCodeKey = dto.studentCode?.toLowerCase();

            if (dto.subjectCode && !preFetchedData.subjects.has(dto.subjectCode.toLowerCase())) {
                errorMessages.push(`รหัสวิชา "${dto.subjectCode}" ไม่มีในระบบ`);
            }
            if (dto.subjectCode && dto.section && !preFetchedData.sections.has(sectionKey)) {
                errorMessages.push(`กลุ่มเรียน "${dto.section}" ของวิชา "${dto.subjectCode}" ไม่มีในระบบ`);
            }
            if (dto.studentCode && !preFetchedData.students.has(studentCodeKey)) {
                errorMessages.push(`รหัสนักเรียน "${dto.studentCode}" ไม่มีในระบบ`);
            }

            const sectionId = preFetchedData.sections.get(sectionKey);
            const studentId = preFetchedData.students.get(studentCodeKey);
            const enrollmentFileKey = `${dto.subjectCode?.toLowerCase()}|${dto.section?.toLowerCase()}|${studentCodeKey}`;

            if (sectionId && studentId) {
                const enrollmentDBKey = `${sectionId}|${studentId}`;
                // เช็คซ้ำในระบบ
                if (preFetchedData.existingEnrollments.has(enrollmentDBKey)) {
                    warningMessages.push(`นักเรียน "${dto.studentCode}" ลงทะเบียนกลุ่มเรียน "${dto.section}" ของวิชา "${dto.subjectCode}" แล้ว (จะข้ามการบันทึก)`);
                    isDuplicate = true;
                } 
                // เช็คซ้ำในไฟล์
                else if (firstOccurrences.get(enrollmentFileKey) !== index) {
                    errorMessages.push(`นักเรียน "${dto.studentCode}" ลงทะเบียนกลุ่มเรียน "${dto.section}" ซ้ำกันภายในไฟล์`);
                }
            }

            results.push({
                row: rowNumber, data: row, isValid: errorMessages.length === 0,
                errors: errorMessages, warnings: warningMessages, isDuplicate
            });
        }
        return results;
    }

    async validateEnrollmentData(instId: number, buffer: Buffer) {
        const rawData = await parseExcelFile(buffer);
        const preFetchedData = await this.preFetchData(instId);

        const firstOccurrences = new Map<string, number>();
        rawData.forEach((row, index) => {
            const dto = plainToInstance(ImportEnrollmentDto, row, { excludeExtraneousValues: true });
            const key = `${dto.subjectCode?.toLowerCase()}|${dto.section?.toLowerCase()}|${dto.studentCode?.toLowerCase()}`;
            if (!firstOccurrences.has(key)) firstOccurrences.set(key, index);
        });

        const indexedData = rawData.map((row, index) => ({ index, row }));
        const batches = chunkArray(indexedData, IMPORT_BATCH_SIZE);
        const validatedData = await processBatchesParallel(
            batches,
            (batch) => this.validateBatch(batch, preFetchedData, firstOccurrences),
            IMPORT_MAX_CONCURRENT_BATCHES
        );

        validatedData.sort((a, b) => a.row - b.row);

        const validCount = validatedData.filter(v => v.isValid).length;
        const errorCount = validatedData.filter(v => !v.isValid).length;
        const duplicateCount = validatedData.filter(v => v.isDuplicate).length;
        const warningCount = validatedData.filter(v => v.warnings.length > 0).length;

        const validationToken = (errorCount === 0 && validCount > 0)
            ? createValidationToken(this.jwtService, { instId, dataHash: calculateDataHash(rawData), validCount, duplicateCount, type: 'enrollment' })
            : null;

        const result = {
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
        preFetchedData: PreFetchedData
    ): Promise<{
        savedCount: number;
        skippedCount: number;
    }> {
        let savedCount = 0;
        let skippedCount = 0;

        for (const row of batch) {
            const dto = plainToInstance(ImportEnrollmentDto, row, { excludeExtraneousValues: true });

            // หา section_id
            const sectionKey = `${dto.subjectCode.toLowerCase()}|${dto.section.toLowerCase()}`;
            const sectionId = preFetchedData.sections.get(sectionKey);
            if (!sectionId) {
                throw new NotFoundException(`กลุ่มเรียน "${dto.section}" ของวิชา "${dto.subjectCode}" ไม่พบในระบบ`);
            }

            // หา student_id
            const studentId = preFetchedData.students.get(dto.studentCode.toLowerCase());
            if (!studentId) {
                throw new NotFoundException(`รหัสนักเรียน "${dto.studentCode}" ไม่พบในระบบ`);
            }

            // เช็ค duplicate
            const enrollmentKey = `${sectionId}|${studentId}`;
            if (preFetchedData.existingEnrollments.has(enrollmentKey)) {
                console.log(`[INFO] Skipping duplicate enrollment: ${dto.studentCode} - ${dto.section}`);
                skippedCount++;
                continue;
            }

            // Insert enrollment
            const insertEnrollmentQuery = `
                INSERT INTO enrollment (section_id, student_id, flag_valid, enrolled_at)
                VALUES ($1, $2, true, NOW())
            `;
            await queryRunner.manager.query(insertEnrollmentQuery, [sectionId, studentId]);

            // เพิ่มเข้า Set เพื่อป้องกัน duplicate ในไฟล์เดียวกัน
            preFetchedData.existingEnrollments.add(enrollmentKey);

            savedCount++;
            console.log(`[INFO] Enrolled student "${dto.studentCode}" to section "${dto.section}" of subject "${dto.subjectCode}"`);
        }

        return { savedCount, skippedCount };
    }

    async saveEnrollmentData(instId: number, buffer: Buffer, validationToken?: string) {
        if (!validationToken) {
            throw new BadRequestException('กรุณา validate ข้อมูลก่อนบันทึก (ต้องระบุ validationToken)');
        }

        const rawData = await parseExcelFile(buffer);

        console.log(`[DEBUG] Saving enrollments for inst_id: ${instId}`);

        const payload = verifyValidationToken(
            this.jwtService,
            validationToken,
            'enrollment',
            instId,
            rawData
        );

        console.log(`[INFO] Valid token - proceeding to save ${payload.validCount} records (${payload.duplicateCount || 0} duplicates will be skipped)`);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let totalSavedCount = 0;
        let totalSkippedCount = 0;

        try {
            // ตรวจสอบสถาบัน
            const inst = await queryRunner.manager.findOne('Institution', {
                where: { inst_id: instId }
            }) as any;
            if (!inst) {
                throw new NotFoundException(`สถาบันที่มี id ${instId} ไม่พบในระบบ`);
            }

            // Pre-fetch ข้อมูลทั้งหมด
            const preFetchedData = await this.preFetchData(instId);

            const batches = chunkArray(rawData, IMPORT_BATCH_SIZE);
            console.log(`[INFO] Saving ${rawData.length} records in ${batches.length} batches`);

            for (let i = 0; i < batches.length; i++) {
                console.log(`[INFO] Processing batch ${i + 1}/${batches.length}`);
                const { savedCount, skippedCount } = await this.saveBatch(
                    batches[i],
                    queryRunner,
                    preFetchedData
                );
                totalSavedCount += savedCount;
                totalSkippedCount += skippedCount;
            }

            await queryRunner.commitTransaction();

            const result = {
                count: totalSavedCount,
                skippedCount: totalSkippedCount,
                skippedReason: totalSkippedCount > 0 ? 'ข้อมูลซ้ำในระบบ' : null
            }

            return {
                success: true,
                message: `นำเข้าข้อมูลการลงทะเบียนสำเร็จ ${totalSavedCount} รายการ`,
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

