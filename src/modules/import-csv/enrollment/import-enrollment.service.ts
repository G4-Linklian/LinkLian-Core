import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { parseExcelFile } from '../shared/utils/excel.util';
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
    students: Map<string, number>; 
    existingEnrollments: Set<number>; // student_id ที่ลงทะเบียนใน section นี้แล้ว
}

@Injectable()
export class ImportEnrollmentService {
    constructor(
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

    private async preFetchData(instId: number, sectionId: number): Promise<PreFetchedData> {
        const [students, existingEnrollments] = await Promise.all([
            // Students (role_id 2 = school student, 3 = university student)
            this.userRepository.find({
                where: { inst_id: instId, flag_valid: true },
                select: ['user_sys_id', 'code', 'role_id']
            }),

            // Existing enrollments for this section
            this.dataSource.query(
                `SELECT e.student_id
                 FROM enrollment e
                 WHERE e.section_id = $1 AND e.flag_valid = true`,
                [sectionId]
            ) as Promise<{ student_id: number }[]>
        ]);

        // Filter เฉพาะ students role_id 2 หรือ 3
        const studentUsers = students.filter(s => s.role_id === 2 || s.role_id === 3);

        const result = {
            students: new Map(
                studentUsers
                    .filter(s => s.code)
                    .map(s => [s.code!.toLowerCase(), s.user_sys_id] as [string, number])
            ),
            existingEnrollments: new Set(existingEnrollments.map(e => e.student_id))
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

            const studentCodeKey = dto.studentCode?.toLowerCase();

            if (dto.studentCode && !preFetchedData.students.has(studentCodeKey)) {
                errorMessages.push(`รหัสนักเรียน "${dto.studentCode}" ไม่มีในระบบ`);
            }

            const studentId = preFetchedData.students.get(studentCodeKey);

            if (studentId) {
                // เช็คซ้ำในระบบ
                if (preFetchedData.existingEnrollments.has(studentId)) {
                    warningMessages.push(`นักเรียน "${dto.studentCode}" ลงทะเบียนในกลุ่มเรียนนี้แล้ว (จะข้ามการบันทึก)`);
                    isDuplicate = true;
                } 
                // เช็คซ้ำในไฟล์
                else if (firstOccurrences.get(studentCodeKey) !== index) {
                    errorMessages.push(`นักเรียน "${dto.studentCode}" ซ้ำกันภายในไฟล์`);
                }
            }

            results.push({
                row: rowNumber, data: { 'รหัสนักเรียน': dto.studentCode }, isValid: errorMessages.length === 0,
                errors: errorMessages, warnings: warningMessages, isDuplicate
            });
        }
        return results;
    }

    async validateEnrollmentData(instId: number, sectionId: number, buffer: Buffer) {
        const rawData = await parseExcelFile(buffer);

        // ตรวจสอบ section มีอยู่จริงและตรงกับ inst_id
        const section = await this.dataSource.query(
            `SELECT sec.section_id
             FROM section sec
             INNER JOIN subject s ON sec.subject_id = s.subject_id
             INNER JOIN learning_area la ON s.learning_area_id = la.learning_area_id
             WHERE sec.section_id = $1 AND la.inst_id = $2 AND sec.flag_valid = true`,
            [sectionId, instId]
        );
        if (!section || section.length === 0) {
            throw new NotFoundException(`Section ID ${sectionId} ไม่พบในระบบหรือไม่ตรงกับสถาบัน`);
        }

        const preFetchedData = await this.preFetchData(instId, sectionId);

        const firstOccurrences = new Map<string, number>();
        rawData.forEach((row, index) => {
            const dto = plainToInstance(ImportEnrollmentDto, row, { excludeExtraneousValues: true });
            const key = dto.studentCode?.toLowerCase();
            if (key && !firstOccurrences.has(key)) firstOccurrences.set(key, index);
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
            ? createValidationToken(this.jwtService, { instId, sectionId, dataHash: calculateDataHash(rawData), validCount, duplicateCount, type: 'enrollment' })
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
        preFetchedData: PreFetchedData,
        sectionId: number
    ): Promise<{
        savedCount: number;
        skippedCount: number;
    }> {
        let savedCount = 0;
        let skippedCount = 0;

        for (const row of batch) {
            const dto = plainToInstance(ImportEnrollmentDto, row, { excludeExtraneousValues: true });

            // หา student_id
            const studentId = preFetchedData.students.get(dto.studentCode.toLowerCase());
            if (!studentId) {
                throw new NotFoundException(`รหัสนักเรียน "${dto.studentCode}" ไม่พบในระบบ`);
            }

            // เช็ค duplicate
            if (preFetchedData.existingEnrollments.has(studentId)) {
                console.log(`[INFO] Skipping duplicate enrollment: ${dto.studentCode}`);
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
            preFetchedData.existingEnrollments.add(studentId);

            savedCount++;
            console.log(`[INFO] Enrolled student "${dto.studentCode}" to section ${sectionId}`);
        }

        return { savedCount, skippedCount };
    }

    async saveEnrollmentData(instId: number, sectionId: number, buffer: Buffer, validationToken?: string) {
        if (!validationToken) {
            throw new BadRequestException('กรุณา validate ข้อมูลก่อนบันทึก (ต้องระบุ validationToken)');
        }

        const rawData = await parseExcelFile(buffer);

        console.log(`[DEBUG] Saving enrollments for inst_id: ${instId}, section_id: ${sectionId}`);

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
            const preFetchedData = await this.preFetchData(instId, sectionId);

            const batches = chunkArray(rawData, IMPORT_BATCH_SIZE);
            console.log(`[INFO] Saving ${rawData.length} records in ${batches.length} batches`);

            for (let i = 0; i < batches.length; i++) {
                console.log(`[INFO] Processing batch ${i + 1}/${batches.length}`);
                const { savedCount, skippedCount } = await this.saveBatch(
                    batches[i],
                    queryRunner,
                    preFetchedData,
                    sectionId
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

