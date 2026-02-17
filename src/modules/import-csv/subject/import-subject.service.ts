import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { parseExcelFile } from '../shared/utils/excel.util';
import { ImportSubjectDto } from './dto/import-subject.dto';
import { LearningArea } from '../../learning-area/entities/learning-area.entity';
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

@Injectable()
export class ImportSubjectService {
    constructor(
        @InjectRepository(LearningArea)
        private learningAreaRepo: Repository<LearningArea>,
        private dataSource: DataSource,
        private jwtService: JwtService
    ) { }

    private async validateBatch(
        batch: { index: number; row: any }[],
        existingSubjectCodes: Set<string>,
        firstOccurrences: Map<string, number> // เก็บ code -> index แรกที่พบในไฟล์
    ): Promise<ValidatedRow[]> {
        const results: ValidatedRow[] = [];

        for (const { index, row } of batch) {
            const rowNumber = index + 2;
            const errorMessages: string[] = [];
            const warningMessages: string[] = [];
            let isDuplicate = false;

            // DTO validation
            const subjectDto = plainToInstance(ImportSubjectDto, row, { excludeExtraneousValues: true });
            const rowErrors = await validate(subjectDto);

            if (rowErrors.length > 0) {
                errorMessages.push(...rowErrors.map(e => Object.values(e.constraints || {}).join(', ')));
            }

            // ตรวจสอบรหัสวิชา
            if (subjectDto.subjectCode) {
                const codeLower = subjectDto.subjectCode.toLowerCase().trim();

                // เช็คซ้ำในระบบ 
                if (existingSubjectCodes.has(codeLower)) {
                    warningMessages.push(`รหัสวิชา "${subjectDto.subjectCode}" มีอยู่ในระบบแล้ว (จะข้ามการบันทึก)`);
                    isDuplicate = true;
                } 
                // เช็คซ้ำในไฟล์
                else if (firstOccurrences.get(codeLower) !== index) {
                    errorMessages.push(`รหัสวิชา "${subjectDto.subjectCode}" ซ้ำกันภายในไฟล์`);
                }
            }

            // ตรวจสอบค่า credit และ hourPerWeek 
            if (row['หน่วยกิต'] !== undefined && row['หน่วยกิต'] !== null && row['หน่วยกิต'] !== '') {
                const credit = parseFloat(row['หน่วยกิต'].toString());
                if (isNaN(credit)) {
                    errorMessages.push(`หน่วยกิต "${row['หน่วยกิต']}" ไม่ใช่ตัวเลขที่ถูกต้อง`);
                } else if (credit < 0) {
                    errorMessages.push('หน่วยกิตต้องเป็นค่าบวก');
                }
            }

            if (row['ชั่วโมงต่อสัปดาห์'] !== undefined && row['ชั่วโมงต่อสัปดาห์'] !== null && row['ชั่วโมงต่อสัปดาห์'] !== '') {
                const hourPerWeek = parseInt(row['ชั่วโมงต่อสัปดาห์'].toString(), 10);
                if (isNaN(hourPerWeek)) {
                    errorMessages.push(`ชั่วโมงต่อสัปดาห์ "${row['ชั่วโมงต่อสัปดาห์']}" ไม่ใช่ตัวเลขที่ถูกต้อง`);
                } else if (hourPerWeek < 0) {
                    errorMessages.push('ชั่วโมงต่อสัปดาห์ต้องเป็นค่าบวก');
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

    async validateSubjectData(instId: number, buffer: Buffer) {
        const rawData = await parseExcelFile(buffer);

        // Pre-fetch ข้อมูลระบบ
        const existingSubjects = await this.dataSource.query(
            `SELECT s.subject_code 
             FROM subject s
             INNER JOIN learning_area la ON s.learning_area_id = la.learning_area_id
             WHERE la.inst_id = $1 AND s.flag_valid = true`,
            [instId]
        ) as { subject_code: string }[];

        const existingSubjectCodes = new Set<string>(
            existingSubjects.map(s => s.subject_code?.toLowerCase().trim()).filter(Boolean)
        );

        const firstOccurrences = new Map<string, number>();
        rawData.forEach((row, index) => {
            const code = row['รหัสวิชา']?.toString().toLowerCase().trim();
            if (code && !firstOccurrences.has(code)) {
                firstOccurrences.set(code, index);
            }
        });

        const indexedData = rawData.map((row, index) => ({ index, row }));
        const batches = chunkArray(indexedData, IMPORT_BATCH_SIZE);

        const validatedData = await processBatchesParallel(
            batches,
            (batch) => this.validateBatch(batch, existingSubjectCodes, firstOccurrences),
            IMPORT_MAX_CONCURRENT_BATCHES
        );

        validatedData.sort((a, b) => a.row - b.row);

        const validCount = validatedData.filter(item => item.isValid).length;
        const errorCount = validatedData.filter(item => !item.isValid).length;
        const duplicateCount = validatedData.filter(item => item.isDuplicate).length;
        const warningCount = validatedData.filter(item => item.warnings.length > 0).length;

        let validationToken: string | null = null;
        if (errorCount === 0 && validCount > 0) {
            validationToken = createValidationToken(this.jwtService, {
                instId,
                dataHash: calculateDataHash(rawData),
                validCount,
                duplicateCount,
                type: 'subject'
            });
        }

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
            success : true,
            data: result,
            validationToken
        };
    }

    private async saveBatch(
        batch: any[],
        queryRunner: any,
        learningAreaMap: Map<string, number>,
        instId: number,
        existingSubjectCodes: Set<string>
    ): Promise<{ 
        savedSubjectCount: number; 
        skippedCount: number; 
        newLearningAreas: string[];
    }> {
        let savedSubjectCount = 0;
        let skippedCount = 0;
        const newLearningAreas: string[] = [];

        for (const row of batch) {
            const subjectDto = plainToInstance(ImportSubjectDto, row, { excludeExtraneousValues: true });

            // ข้าม duplicate
            const codeLower = subjectDto.subjectCode?.toLowerCase();
            if (codeLower && existingSubjectCodes.has(codeLower)) {
                console.log(`[INFO] Skipping duplicate subject: ${subjectDto.subjectCode}`);
                skippedCount++;
                continue;
            }

            // หา learning_area_id หรือสร้างใหม่
            let learningAreaId = learningAreaMap.get(subjectDto.learningArea.toLowerCase());

            if (!learningAreaId) {
                const insertLearningAreaQuery = `
                    INSERT INTO learning_area (inst_id, learning_area_name, flag_valid)
                    VALUES ($1, $2, true)
                    RETURNING learning_area_id
                `;
                const laResult = await queryRunner.manager.query(insertLearningAreaQuery, [
                    instId,
                    subjectDto.learningArea
                ]);
                learningAreaId = laResult[0]?.learning_area_id;
                if (!learningAreaId) {
                    throw new Error(`Failed to create learning area: ${subjectDto.learningArea}`);
                }
                learningAreaMap.set(subjectDto.learningArea.toLowerCase(), learningAreaId);
                newLearningAreas.push(subjectDto.learningArea);
                console.log(`[INFO] Created new learning area: "${subjectDto.learningArea}" (id: ${learningAreaId}) for inst_id: ${instId}`);
            }

            // บันทึก subject
            const insertSubjectQuery = `
                INSERT INTO subject 
                (subject_code, name_th, name_en, learning_area_id, credit, hour_per_week, flag_valid, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
                RETURNING subject_id
            `;

            const values = [
                subjectDto.subjectCode,
                subjectDto.subjectNameTH,
                subjectDto.subjectNameENG || null,
                learningAreaId,
                subjectDto.credit,      
                subjectDto.hourPerWeek  
            ];

            await queryRunner.manager.query(insertSubjectQuery, values);

            // เพิ่มเข้า Set เพื่อป้องกัน duplicate ในไฟล์เดียวกัน
            if (codeLower) existingSubjectCodes.add(codeLower);

            savedSubjectCount++;
        }

        return { savedSubjectCount, skippedCount, newLearningAreas };
    }

    async saveSubjectData(instId: number, buffer: Buffer, validationToken?: string) {
        if (!validationToken) {
            throw new BadRequestException('กรุณา validate ข้อมูลก่อนบันทึก (ต้องระบุ validationToken)');
        }

        const rawData = await parseExcelFile(buffer);

        console.log(`[DEBUG] Saving subjects for inst_id: ${instId} (from header)`);

        const payload = verifyValidationToken(
            this.jwtService,
            validationToken,
            'subject',
            instId,
            rawData
        );

        console.log(`[INFO] Valid token - proceeding to save ${payload.validCount} records (${payload.duplicateCount || 0} duplicates will be skipped)`);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let totalSavedSubjectCount = 0;
        let totalSkippedCount = 0;
        const allNewLearningAreas: string[] = [];

        try {
            const inst = await queryRunner.manager.findOne('Institution', {
                where: { inst_id: instId }
            }) as any;
            if (!inst) {
                throw new NotFoundException(`สถาบันที่มี id ${instId} ไม่พบในระบบ`);
            }

            const [learningAreas, existingSubjects] = await Promise.all([
                this.learningAreaRepo.find({
                    where: { inst_id: instId, flag_valid: true }
                }),
                this.dataSource.query(
                    `SELECT s.subject_code 
                     FROM subject s
                     INNER JOIN learning_area la ON s.learning_area_id = la.learning_area_id
                     WHERE la.inst_id = $1 AND s.flag_valid = true`,
                    [instId]
                ) as Promise<{ subject_code: string }[]>
            ]);

            const learningAreaMap = new Map<string, number>(
                learningAreas.map(la => [la.learning_area_name.toLowerCase(), la.learning_area_id])
            );

            const existingSubjectCodes = new Set<string>(
                existingSubjects.map(s => s.subject_code?.toLowerCase()).filter(Boolean)
            );

            const batches = chunkArray(rawData, IMPORT_BATCH_SIZE);
            console.log(`[INFO] Saving ${rawData.length} records in ${batches.length} batches for inst_id: ${instId}`);

            for (let i = 0; i < batches.length; i++) {
                console.log(`[INFO] Processing batch ${i + 1}/${batches.length}`);
                const { savedSubjectCount, skippedCount, newLearningAreas } = await this.saveBatch(
                    batches[i],
                    queryRunner,
                    learningAreaMap,
                    instId,
                    existingSubjectCodes
                );
                totalSavedSubjectCount += savedSubjectCount;
                totalSkippedCount += skippedCount;
                allNewLearningAreas.push(...newLearningAreas);
            }

            await queryRunner.commitTransaction();

            const uniqueNewLearningAreas = [...new Set(allNewLearningAreas)];

            const result = {
                count: totalSavedSubjectCount,
                skippedCount: totalSkippedCount,
                skippedReason: totalSkippedCount > 0 ? 'ข้อมูลซ้ำในระบบ' : null,
                newLearningAreas: uniqueNewLearningAreas.length > 0 ? uniqueNewLearningAreas : null
            }

            return {
                success: true,
                message: `นำเข้าข้อมูลวิชาสำเร็จ ${totalSavedSubjectCount} รายการ`,
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