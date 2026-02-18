import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { parseExcelFile } from '../shared/utils/excel.util';
import { Program, ProgramType, TreeType } from '../../program/entities/program.entity';
import { Institution } from '../../institution/entities/institution.entity';
import { ImportSchoolProgramDto, ImportUniProgramDto } from './dto/import-program.dto';
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
export class ImportProgramService {
    constructor(
        @InjectRepository(Program)
        private programRepo: Repository<Program>,
        @InjectRepository(Institution)
        private institutionRepo: Repository<Institution>,
        private jwtService: JwtService,
        private dataSource: DataSource
    ) {}

    private async validateSchoolBatch(
        batch: { index: number; row: any }[],
        existingCombinations: Set<string>,
        firstOccurrences: Map<string, number>
    ): Promise<ValidatedRow[]> {
        const results: ValidatedRow[] = [];

        for (const { index, row } of batch) {
            const rowNumber = index + 2;
            const errorMessages: string[] = [];
            const warningMessages: string[] = [];
            let isDuplicate = false;

            const dto = plainToInstance(ImportSchoolProgramDto, row, { excludeExtraneousValues: true });
            const rowErrors = await validate(dto);
            if (rowErrors.length > 0) {
                errorMessages.push(...rowErrors.map(e => Object.values(e.constraints || {}).join(', ')));
            }

            const combinationKey = `${dto.programName?.toLowerCase()}|${dto.className?.toLowerCase()}`;
            
            // เช็คซ้ำในระบบ
            if (existingCombinations.has(combinationKey)) {
                warningMessages.push(`แผนการเรียน "${dto.programName}" + ห้อง "${dto.className}" มีอยู่ในระบบแล้ว (จะข้ามการบันทึก)`);
                isDuplicate = true;
            } 
            // เช็คซ้ำในไฟล์
            else if (firstOccurrences.get(combinationKey) !== index) {
                errorMessages.push(`ข้อมูลแผนการเรียนและห้องเรียนซ้ำกันภายในไฟล์`);
            }

            results.push({
                row: rowNumber, data: row, isValid: errorMessages.length === 0,
                errors: errorMessages, warnings: warningMessages, isDuplicate
            });
        }
        return results;
    }

    private async validateUniBatch(
        batch: { index: number; row: any }[],
        existingCombinations: Set<string>,
        firstOccurrences: Map<string, number>
    ): Promise<ValidatedRow[]> {
        const results: ValidatedRow[] = [];

        for (const { index, row } of batch) {
            const rowNumber = index + 2;
            const errorMessages: string[] = [];
            const warningMessages: string[] = [];
            let isDuplicate = false;

            const dto = plainToInstance(ImportUniProgramDto, row, { excludeExtraneousValues: true });
            const rowErrors = await validate(dto);
            if (rowErrors.length > 0) {
                errorMessages.push(...rowErrors.map(e => Object.values(e.constraints || {}).join(', ')));
            }

            const combinationKey = `${dto.faculty?.toLowerCase()}|${dto.department?.toLowerCase()}|${dto.major?.toLowerCase()}`;
            
            // เช็คซ้ำในระบบ
            if (existingCombinations.has(combinationKey)) {
                warningMessages.push(`คณะ "${dto.faculty}" + ภาค "${dto.department}" + สาขา "${dto.major}" มีอยู่ในระบบแล้ว (จะข้ามการบันทึก)`);
                isDuplicate = true;
            } 
            // เช็คซ้ำในไฟล์
            else if (firstOccurrences.get(combinationKey) !== index) {
                errorMessages.push(`ข้อมูลคณะ ภาค และสาขาซ้ำกันภายในไฟล์`);
            }

            results.push({
                row: rowNumber, data: row, isValid: errorMessages.length === 0,
                errors: errorMessages, warnings: warningMessages, isDuplicate
            });
        }
        return results;
    }

    async validateProgramData(instId: number, instType: string, buffer: Buffer) {
        const rawData = await parseExcelFile(buffer);
        const isSchool = instType === 'school';
        const isUniversity = instType === 'university' || instType === 'uni';

        if (!isSchool && !isUniversity) throw new BadRequestException(`ประเภทสถาบัน "${instType}" ไม่รองรับ`);

        // Pre-fetch
        const existingPrograms = await this.programRepo.find({ where: { inst_id: instId, flag_valid: true } });
        const existingCombinations = new Set<string>();

        console.log(`[DEBUG] Total programs found for inst_id ${instId}: ${existingPrograms.length}`);
        console.log(`[DEBUG] All program types in DB:`, existingPrograms.map(p => ({ id: p.program_id, name: p.program_name, type: p.program_type, parent_id: p.parent_id })));

        if (isSchool) {
            const studyPlans = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.STUDY_PLAN.toLowerCase());
            const classes = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.CLASS.toLowerCase());
            console.log(`[DEBUG] Found ${studyPlans.length} study plans, ${classes.length} classes`);
            
            classes.forEach(cls => {
                const parent = studyPlans.find(sp => sp.program_id === Number(cls.parent_id));
                if (parent) {
                    existingCombinations.add(`${parent.program_name.toLowerCase()}|${cls.program_name.toLowerCase()}`);
                } else {
                    console.log(`[DEBUG] Class "${cls.program_name}" has parent_id ${cls.parent_id} but no matching study plan found`);
                }
            });
        } else {
            const faculties = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.FACULTY.toLowerCase());
            const depts = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.DEPARTMENT.toLowerCase());
            existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.MAJOR.toLowerCase()).forEach(major => {
                const dept = depts.find(d => d.program_id === Number(major.parent_id));
                const faculty = dept ? faculties.find(f => f.program_id === Number(dept.parent_id)) : null;
                if (faculty && dept) existingCombinations.add(`${faculty.program_name.toLowerCase()}|${dept.program_name.toLowerCase()}|${major.program_name.toLowerCase()}`);
            });
            console.log(`[DEBUG] Found ${faculties.length} faculties, ${depts.length} departments and ${existingCombinations.size} existing combinations`);
        }

        const firstOccurrences = new Map<string, number>();
        rawData.forEach((row, index) => {
            let key: string;
            if (isSchool) {
                const dto = plainToInstance(ImportSchoolProgramDto, row, { excludeExtraneousValues: true });
                key = `${dto.programName?.toLowerCase()}|${dto.className?.toLowerCase()}`;
            } else {
                const dto = plainToInstance(ImportUniProgramDto, row, { excludeExtraneousValues: true });
                key = `${dto.faculty?.toLowerCase()}|${dto.department?.toLowerCase()}|${dto.major?.toLowerCase()}`;
            }
            if (!firstOccurrences.has(key)) firstOccurrences.set(key, index);
        });

        const batches = chunkArray(rawData.map((row, index) => ({ index, row })), IMPORT_BATCH_SIZE);
        const validatedData = await processBatchesParallel(
            batches,
            (batch) => isSchool 
                ? this.validateSchoolBatch(batch, existingCombinations, firstOccurrences)
                : this.validateUniBatch(batch, existingCombinations, firstOccurrences),
            IMPORT_MAX_CONCURRENT_BATCHES
        );

        validatedData.sort((a, b) => a.row - b.row);

        const validCount = validatedData.filter(v => v.isValid).length;
        const errorCount = validatedData.filter(v => !v.isValid).length;
        const duplicateCount = validatedData.filter(v => v.isDuplicate).length;
        const warningCount = validatedData.filter(v => v.warnings.length > 0).length;

        const validationToken = (errorCount === 0 && validCount > 0)
            ? createValidationToken(this.jwtService, { instId, dataHash: calculateDataHash(rawData), validCount, duplicateCount, type: 'program' })
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
            },
        }

        return {
            success: true,
            data: result,
            validationToken
        };
    }

    private async saveSchoolBatch(
        batch: any[],
        queryRunner: any,
        instId: number,
        existingStudyPlans: Map<string, number>,
        existingCombinations: Set<string>
    ): Promise<{ savedCount: number; skippedCount: number; }> {
        let savedCount = 0;
        let skippedCount = 0;

        for (const row of batch) {
            const dto = plainToInstance(ImportSchoolProgramDto, row, { excludeExtraneousValues: true });
            const studyPlanName = dto.programName?.trim();
            const className = dto.className?.trim();

            // เช็ค combination ซ้ำ
            const combinationKey = `${studyPlanName?.toLowerCase()}|${className?.toLowerCase()}`;
            if (existingCombinations.has(combinationKey)) {
                console.log(`[INFO] Skipping duplicate: ${studyPlanName} + ${className}`);
                skippedCount++;
                continue;
            }

            let studyPlanId = existingStudyPlans.get(studyPlanName.toLowerCase());

            if (!studyPlanId) {
                // ใช้ ON CONFLICT DO NOTHING เพื่อป้องกัน duplicate key error
                const insertStudyPlanQuery = `
                    INSERT INTO program (inst_id, program_name, program_type, tree_type, parent_id, flag_valid, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, NULL, true, NOW(), NOW())
                    ON CONFLICT ON CONSTRAINT uq_program DO NOTHING
                    RETURNING program_id
                `;
                const studyPlanResult = await queryRunner.manager.query(insertStudyPlanQuery, [
                    instId,
                    studyPlanName,
                    ProgramType.STUDY_PLAN,
                    TreeType.ROOT
                ]);
                studyPlanId = studyPlanResult[0]?.program_id;

                if (!studyPlanId) {
                    const existingQuery = `
                        SELECT program_id FROM program 
                        WHERE inst_id = $1 AND program_name = $2 AND program_type = $3 AND parent_id IS NULL AND flag_valid = true
                    `;
                    const existingResult = await queryRunner.manager.query(existingQuery, [
                        instId, studyPlanName, ProgramType.STUDY_PLAN
                    ]);
                    studyPlanId = existingResult[0]?.program_id;
                    
                    if (!studyPlanId) {
                        throw new Error(`Failed to create or find study plan: ${studyPlanName}`);
                    }
                    console.log(`[INFO] Using existing study plan: "${studyPlanName}" (id: ${studyPlanId})`);
                } else {
                    console.log(`[INFO] Created new study plan: "${studyPlanName}" (id: ${studyPlanId})`);
                    savedCount++;
                }

                existingStudyPlans.set(studyPlanName.toLowerCase(), studyPlanId);
            }

            const insertClassQuery = `
                INSERT INTO program (inst_id, program_name, program_type, parent_id, tree_type, flag_valid, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
                ON CONFLICT ON CONSTRAINT uq_program DO NOTHING
                RETURNING program_id
            `;
            const classResult = await queryRunner.manager.query(insertClassQuery, [
                instId,
                className,
                ProgramType.CLASS,
                studyPlanId,
                TreeType.LEAF
            ]);

            if (classResult[0]?.program_id) {
                savedCount++;
            } else {
                console.log(`[INFO] Class "${className}" under "${studyPlanName}" already exists, skipping`);
                skippedCount++;
            }

            existingCombinations.add(combinationKey);
        }

        return { savedCount, skippedCount };
    }

    private async saveUniBatch(
        batch: any[],
        queryRunner: any,
        instId: number,
        existingFaculties: Map<string, number>,
        existingDepartments: Map<string, number>,
        existingCombinations: Set<string>
    ): Promise<{ savedCount: number; skippedCount: number; }> {
        let savedCount = 0;
        let skippedCount = 0;

        for (const row of batch) {
            const dto = plainToInstance(ImportUniProgramDto, row, { excludeExtraneousValues: true });
            const facultyName = dto.faculty?.trim();
            const departmentName = dto.department?.trim();
            const majorName = dto.major?.trim();

            // เช็ค combination ซ้ำ
            const combinationKey = `${facultyName?.toLowerCase()}|${departmentName?.toLowerCase()}|${majorName?.toLowerCase()}`;
            if (existingCombinations.has(combinationKey)) {
                console.log(`[INFO] Skipping duplicate: ${facultyName} + ${departmentName} + ${majorName}`);
                skippedCount++;
                continue;
            }

            let facultyId = existingFaculties.get(facultyName.toLowerCase());

            if (!facultyId) {
                const insertFacultyQuery = `
                    INSERT INTO program (inst_id, program_name, program_type, tree_type, parent_id, flag_valid, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, NULL, true, NOW(), NOW())
                    ON CONFLICT ON CONSTRAINT uq_program DO NOTHING
                    RETURNING program_id
                `;
                const facultyResult = await queryRunner.manager.query(insertFacultyQuery, [
                    instId,
                    facultyName,
                    ProgramType.FACULTY,
                    TreeType.ROOT
                ]);
                facultyId = facultyResult[0]?.program_id;

                if (!facultyId) {
                    const existingQuery = `
                        SELECT program_id FROM program 
                        WHERE inst_id = $1 AND program_name = $2 AND program_type = $3 AND parent_id IS NULL AND flag_valid = true
                    `;
                    const existingResult = await queryRunner.manager.query(existingQuery, [
                        instId, facultyName, ProgramType.FACULTY
                    ]);
                    facultyId = existingResult[0]?.program_id;
                    
                    if (!facultyId) {
                        throw new Error(`Failed to create or find faculty: ${facultyName}`);
                    }
                    console.log(`[INFO] Using existing faculty: "${facultyName}" (id: ${facultyId})`);
                } else {
                    console.log(`[INFO] Created new faculty: "${facultyName}" (id: ${facultyId})`);
                    savedCount++;
                }

                existingFaculties.set(facultyName.toLowerCase(), facultyId);
            }

            const deptKey = `${facultyName.toLowerCase()}|${departmentName.toLowerCase()}`;
            let departmentId = existingDepartments.get(deptKey);

            if (!departmentId) {
                const insertDeptQuery = `
                    INSERT INTO program (inst_id, program_name, program_type, parent_id, tree_type, flag_valid, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
                    ON CONFLICT ON CONSTRAINT uq_program DO NOTHING
                    RETURNING program_id
                `;
                const deptResult = await queryRunner.manager.query(insertDeptQuery, [
                    instId,
                    departmentName,
                    ProgramType.DEPARTMENT,
                    facultyId,
                    TreeType.TWIG
                ]);
                departmentId = deptResult[0]?.program_id;

                if (!departmentId) {
                    const existingQuery = `
                        SELECT program_id FROM program 
                        WHERE inst_id = $1 AND program_name = $2 AND program_type = $3 AND parent_id = $4 AND flag_valid = true
                    `;
                    const existingResult = await queryRunner.manager.query(existingQuery, [
                        instId, departmentName, ProgramType.DEPARTMENT, facultyId
                    ]);
                    departmentId = existingResult[0]?.program_id;
                    
                    if (!departmentId) {
                        throw new Error(`Failed to create or find department: ${departmentName}`);
                    }
                    console.log(`[INFO] Using existing department: "${departmentName}" (id: ${departmentId})`);
                } else {
                    console.log(`[INFO] Created new department: "${departmentName}" (id: ${departmentId})`);
                    savedCount++;
                }

                existingDepartments.set(deptKey, departmentId);
            }

            const insertMajorQuery = `
                INSERT INTO program (inst_id, program_name, program_type, parent_id, tree_type, flag_valid, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
                ON CONFLICT ON CONSTRAINT uq_program DO NOTHING
                RETURNING program_id
            `;
            const majorResult = await queryRunner.manager.query(insertMajorQuery, [
                instId,
                majorName,
                ProgramType.MAJOR,
                departmentId,
                TreeType.LEAF
            ]);

            // ถ้า insert สำเร็จ (ไม่ซ้ำ)
            if (majorResult[0]?.program_id) {
                savedCount++;
            } else {
                console.log(`[INFO] Major "${majorName}" under "${departmentName}" already exists, skipping`);
                skippedCount++;
            }

            // เพิ่ม combination เข้า Set
            existingCombinations.add(combinationKey);
        }

        return { savedCount, skippedCount };
    }

    async saveProgramData(instId: number, instType: string, buffer: Buffer, validationToken?: string) {
        if (!validationToken) {
            throw new BadRequestException('กรุณา validate ข้อมูลก่อนบันทึก (ต้องระบุ validationToken)');
        }

        const rawData = await parseExcelFile(buffer);

        // Validate instType
        const isSchool = instType === 'school';
        const isUniversity = instType === 'university' || instType === 'uni';

        if (!isSchool && !isUniversity) {
            throw new BadRequestException(`ประเภทสถาบัน "${instType}" ไม่รองรับ`);
        }

        console.log(`[DEBUG] Saving programs for inst_id: ${instId}, inst_type: ${instType}`);

        const payload = verifyValidationToken(
            this.jwtService,
            validationToken,
            'program',
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
            // ดึง existing programs
            const existingPrograms = await this.programRepo.find({
                where: { inst_id: instId, flag_valid: true }
            });

            if (isSchool) {
                // สร้าง Map สำหรับ existing study plans
                const existingStudyPlans = new Map<string, number>(
                    existingPrograms
                    .filter(p => p.program_type?.toLowerCase() === ProgramType.STUDY_PLAN.toLowerCase())
                    .map(p => [p.program_name.toLowerCase(), p.program_id])
                );

                // สร้าง Set สำหรับ existing combinations
                const existingCombinations = new Set<string>();
                const studyPlans = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.STUDY_PLAN.toLowerCase());
                const classes = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.CLASS.toLowerCase());

                for (const cls of classes) {
                    const parent = studyPlans.find(sp => sp.program_id === Number(cls.parent_id));
                    if (parent) {
                        existingCombinations.add(`${parent.program_name.toLowerCase()}|${cls.program_name.toLowerCase()}`);
                    }
                }

                const batches = chunkArray(rawData, IMPORT_BATCH_SIZE);
                console.log(`[INFO] Saving ${rawData.length} records in ${batches.length} batches`);

                for (let i = 0; i < batches.length; i++) {
                    console.log(`[INFO] Processing batch ${i + 1}/${batches.length}`);
                    const { savedCount, skippedCount } = await this.saveSchoolBatch(
                        batches[i],
                        queryRunner,
                        instId,
                        existingStudyPlans,
                        existingCombinations
                    );
                    totalSavedCount += savedCount;
                    totalSkippedCount += skippedCount;
                }
            } else {
                // University
                const existingFaculties = new Map<string, number>(
                    existingPrograms
                        .filter(p => p.program_type?.toLowerCase() === ProgramType.FACULTY.toLowerCase())
                        .map(p => [p.program_name.toLowerCase(), p.program_id])
                );

                const existingDepartments = new Map<string, number>();
                const faculties = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.FACULTY.toLowerCase());
                const departments = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.DEPARTMENT.toLowerCase());

                for (const dept of departments) {
                    const faculty = faculties.find(f => f.program_id === Number(dept.parent_id));
                    if (faculty) {
                        const key = `${faculty.program_name.toLowerCase()}|${dept.program_name.toLowerCase()}`;
                        existingDepartments.set(key, dept.program_id);
                    }
                }

                // สร้าง Set สำหรับ existing combinations
                const existingCombinations = new Set<string>();
                const majors = existingPrograms.filter(p => p.program_type?.toLowerCase() === ProgramType.MAJOR.toLowerCase());

                for (const major of majors) {
                    const dept = departments.find(d => d.program_id === Number(major.parent_id));
                    if (dept) {
                        const faculty = faculties.find(f => f.program_id === Number(dept.parent_id));
                        if (faculty) {
                            existingCombinations.add(`${faculty.program_name.toLowerCase()}|${dept.program_name.toLowerCase()}|${major.program_name.toLowerCase()}`);
                        }
                    }
                }

                const batches = chunkArray(rawData, IMPORT_BATCH_SIZE);
                console.log(`[INFO] Saving ${rawData.length} records in ${batches.length} batches`);

                for (let i = 0; i < batches.length; i++) {
                    console.log(`[INFO] Processing batch ${i + 1}/${batches.length}`);
                    const { savedCount, skippedCount } = await this.saveUniBatch(
                        batches[i],
                        queryRunner,
                        instId,
                        existingFaculties,
                        existingDepartments,
                        existingCombinations
                    );
                    totalSavedCount += savedCount;
                    totalSkippedCount += skippedCount;
                }
            }

            await queryRunner.commitTransaction();

            const result = {
                count: totalSavedCount,
                skippedCount: totalSkippedCount,
                skippedReason: totalSkippedCount > 0 ? 'ข้อมูลซ้ำในระบบ' : null,
            }

            return {
                success: true,
                message: `นำเข้าข้อมูลแผนการเรียนสำเร็จ ${totalSavedCount} รายการ`,
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