import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { parseExcelFile } from '../shared/utils/excel.util';
import { ImportSectionScheduleDto } from './dto/import-section-schedule.dto';
import { UserSys } from '../../users/entities/user-sys.entity';
import { Subject } from '../../subject/entities/subject.entity';
import { Section } from '../../section/entities/section.entity';
import { SectionEducator, EducatorPosition } from '../../section/entities/section-educator.entity';
import { SectionSchedule, DayOfWeek } from '../../section/entities/section-schedule.entity';
import { Semester } from '../../semester/entities/semester.entity';
import { Building } from '../../building/entities/building.entity';
import { RoomLocation } from '../../room-location/entities/room-location.entity';
import { Institution } from '../../institution/entities/institution.entity';
import { JwtService } from '@nestjs/jwt';
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

// Map วันภาษาไทยเป็นตัวเลข
const DAY_OF_WEEK_MAP: { [key: string]: DayOfWeek } = {
    'จันทร์': DayOfWeek.MONDAY,
    'อังคาร': DayOfWeek.TUESDAY,
    'พุธ': DayOfWeek.WEDNESDAY,
    'พฤหัสบดี': DayOfWeek.THURSDAY,
    'พฤหัส': DayOfWeek.THURSDAY,
    'ศุกร์': DayOfWeek.FRIDAY,
    'เสาร์': DayOfWeek.SATURDAY,
    'อาทิตย์': DayOfWeek.SUNDAY
};

// Interface สำหรับเก็บข้อมูลที่ pre-fetch
interface PreFetchedData {
    subjects: Map<string, number>;
    buildings: Map<string, number>;
    rooms: Map<string, number>;
    teachers: Map<string, number>;
    existingSections: Set<string>;
}

@Injectable()
export class ImportSectionScheduleService {
    constructor(
        @InjectRepository(UserSys)
        private userRepository: Repository<UserSys>,
        @InjectRepository(Subject)
        private subjectRepository: Repository<Subject>,
        @InjectRepository(Section)
        private sectionRepository: Repository<Section>,
        @InjectRepository(SectionSchedule)
        private sectionScheduleRepository: Repository<SectionSchedule>,
        @InjectRepository(SectionEducator)
        private sectionEducatorRepository: Repository<SectionEducator>,
        @InjectRepository(Institution)
        private institutionRepository: Repository<Institution>,
        @InjectRepository(Semester)
        private semesterRepository: Repository<Semester>,
        @InjectRepository(Building)
        private buildingRepository: Repository<Building>,
        @InjectRepository(RoomLocation)
        private roomLocationRepository: Repository<RoomLocation>,
        private dataSource: DataSource,
        private jwtService: JwtService
    ) {}

    private async preFetchData(instId: number, semesterId: number): Promise<PreFetchedData> {
        const [subjects, buildings, rooms, teachers, existingSections] = await Promise.all([
            // Subjects (ผ่าน learning_area)
            this.dataSource.query(
                `SELECT s.subject_id, s.subject_code 
                 FROM subject s
                 INNER JOIN learning_area la ON s.learning_area_id = la.learning_area_id
                 WHERE la.inst_id = $1 AND s.flag_valid = true`,
                [instId]
            ) as Promise<{ subject_id: number; subject_code: string }[]>,
            // Buildings
            this.buildingRepository.find({
                where: { inst_id: instId, flag_valid: true }
            }),
            // Rooms
            this.dataSource.query(
                `SELECT rl.room_location_id, rl.room_number, b.building_name
                 FROM room_location rl
                 INNER JOIN building b ON rl.building_id = b.building_id
                 WHERE b.inst_id = $1 AND rl.flag_valid = true AND b.flag_valid = true`,
                [instId]
            ) as Promise<{ room_location_id: number; room_number: string; building_name: string }[]>,
            // Teachers 
            this.userRepository.find({
                where: { inst_id: instId, flag_valid: true },
                select: ['user_sys_id', 'code']
            }),
            // Existing sections for this semester (subject_code + section_name)
            this.dataSource.query(
                `SELECT sec.section_id, sec.subject_id, sec.section_name, s.subject_code
                 FROM section sec
                 INNER JOIN subject s ON sec.subject_id = s.subject_id
                 INNER JOIN learning_area la ON s.learning_area_id = la.learning_area_id
                 WHERE la.inst_id = $1 AND sec.semester_id = $2 AND sec.flag_valid = true`,
                [instId, semesterId]
            ) as Promise<{ section_id: number; subject_id: number; section_name: string; subject_code: string }[]>
        ]);

        const result = {
            subjects: new Map(subjects.map(s => [s.subject_code?.toLowerCase() || '', s.subject_id])),
            buildings: new Map(buildings.map(b => [b.building_name?.toLowerCase() || '', b.building_id])),
            rooms: new Map(rooms.map(r => [`${r.building_name?.toLowerCase()}|${r.room_number?.toLowerCase()}`, r.room_location_id])),
            teachers: new Map(
                teachers
                    .filter(t => t.code)
                    .map(t => [t.code!.toLowerCase(), t.user_sys_id] as [string, number])
            ),
            existingSections: new Set(existingSections.map(s => `${s.subject_code?.toLowerCase()}|${s.section_name?.toLowerCase()}`))
        }

        return result;
    }

    private mapDayOfWeek(day: string): DayOfWeek | null {
        const normalizedDay = day?.trim().toLowerCase();
        return DAY_OF_WEEK_MAP[normalizedDay] ?? null;
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

            const dto = plainToInstance(ImportSectionScheduleDto, row, { excludeExtraneousValues: true });
            const rowErrors = await validate(dto);
            if (rowErrors.length > 0) {
                errorMessages.push(...rowErrors.map(e => Object.values(e.constraints || {}).join(', ')));
            }

            if (dto.subjectCode && !preFetchedData.subjects.has(dto.subjectCode.toLowerCase())) errorMessages.push(`รหัสวิชา "${dto.subjectCode}" ไม่มีในระบบ`);
            
            // ตรวจสอบตึก - ถ้าไม่มีจะสร้างใหม่
            if (dto.building && !preFetchedData.buildings.has(dto.building.toLowerCase())) {
                warningMessages.push(`ตึก "${dto.building}" ยังไม่มี (จะสร้างใหม่)`);
            }

            // ตรวจสอบห้องเรียน - ถ้าไม่มีจะสร้างใหม่
            const roomKey = `${dto.building?.toLowerCase()}|${dto.classroom?.toLowerCase()}`;
            if (dto.building && dto.classroom && !preFetchedData.rooms.has(roomKey)) {
                warningMessages.push(`ห้อง "${dto.classroom}" ในตึก "${dto.building}" ยังไม่มี (จะสร้างใหม่)`);
            }

            // ตรวจสอบผู้สอน
            if (dto.mainTeacherCode && !preFetchedData.teachers.has(dto.mainTeacherCode.toLowerCase())) errorMessages.push(`รหัสผู้สอนหลัก "${dto.mainTeacherCode}" ไม่มีในระบบ`);
            if (dto.coTeacherCode && !preFetchedData.teachers.has(dto.coTeacherCode.toLowerCase())) errorMessages.push(`รหัสผู้สอนรอง "${dto.coTeacherCode}" ไม่มีในระบบ`);
            if (dto.taCode && !preFetchedData.teachers.has(dto.taCode.toLowerCase())) errorMessages.push(`รหัสผู้ช่วยสอน "${dto.taCode}" ไม่มีในระบบ`);

            const dayOfWeek = this.mapDayOfWeek(dto.day);
            if (dto.day && dayOfWeek === null) errorMessages.push(`วัน "${dto.day}" ไม่ถูกต้อง`);

            // ตรวจสอบ Duplicate ในระบบ (วิชา/กลุ่มเรียน ใน semester เดียวกัน)
            const sectionKey = `${dto.subjectCode?.toLowerCase()}|${dto.sectionName?.toLowerCase()}`;
            if (preFetchedData.existingSections.has(sectionKey)) {
                warningMessages.push(`กลุ่มเรียน "${dto.sectionName}" วิชา "${dto.subjectCode}" มีอยู่แล้วใน semester นี้ (จะข้ามการบันทึก)`);
                isDuplicate = true;
            }

            // ตรวจสอบ Full Row Duplicate ในไฟล์
            const rowKey = JSON.stringify(row);
            if (firstOccurrences.get(rowKey) !== index) {
                errorMessages.push(`ข้อมูลแถวนี้ซ้ำกันทั้งหมดกับแถวอื่นในไฟล์`);
            }

            results.push({
                row: rowNumber, data: row, isValid: errorMessages.length === 0,
                errors: errorMessages, warnings: warningMessages, isDuplicate
            });
        }
        return results;
    }

    async validateSectionScheduleData(instId: number, semesterId: number, buffer: Buffer) {
        const rawData = await parseExcelFile(buffer);

        // ตรวจสอบ semester มีอยู่จริง
        const semester = await this.semesterRepository.findOne({
            where: { semester_id: semesterId, inst_id: instId, flag_valid: true }
        });
        if (!semester) {
            throw new NotFoundException(`Semester ID ${semesterId} ไม่พบในระบบหรือไม่ตรงกับสถาบัน`);
        }

        const preFetchedData = await this.preFetchData(instId, semesterId);

        const firstOccurrences = new Map<string, number>();
        rawData.forEach((row, index) => {
            // ใช้ข้อมูลทั้งแถวเป็น key เพื่อเช็ค full row duplicate
            const rowKey = JSON.stringify(row);
            if (!firstOccurrences.has(rowKey)) firstOccurrences.set(rowKey, index);
        });

        // Parallel Batch
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
            ? createValidationToken(this.jwtService, { instId, semesterId, dataHash: calculateDataHash(rawData), validCount, duplicateCount, type: 'section-schedule' })
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
            success : true,
            data: result,
            validationToken
        };
    }

    private async saveBatch(
        batch: any[],
        queryRunner: any,
        preFetchedData: PreFetchedData,
        instId: number,
        semesterId: number
    ): Promise<{
        savedCount: number;
        skippedCount: number;
    }> {
        let savedCount = 0;
        let skippedCount = 0;

        for (const row of batch) {
            const dto = plainToInstance(ImportSectionScheduleDto, row, { excludeExtraneousValues: true });

            // เช็ค duplicate
            const sectionKey = `${dto.subjectCode?.toLowerCase()}|${dto.sectionName?.toLowerCase()}`;
            if (preFetchedData.existingSections.has(sectionKey)) {
                console.log(`[INFO] Skipping duplicate section: ${dto.sectionName} - ${dto.subjectCode}`);
                skippedCount++;
                continue;
            }

            // หา subject_id
            const subjectId = preFetchedData.subjects.get(dto.subjectCode.toLowerCase());
            if (!subjectId) {
                throw new NotFoundException(`รหัสวิชา "${dto.subjectCode}" ไม่พบในระบบ`);
            }

            // หาหรือสร้าง building
            let buildingId = preFetchedData.buildings.get(dto.building.toLowerCase());
            if (!buildingId) {
                // สร้างตึกใหม่
                const insertBuildingQuery = `
                    INSERT INTO building (inst_id, building_name, building_no, flag_valid)
                    VALUES ($1, $2, $3, true)
                    RETURNING building_id
                `;
                const buildingResult = await queryRunner.manager.query(insertBuildingQuery, [
                    instId,
                    dto.building,
                    dto.buildingNo,
                ]);
                buildingId = buildingResult[0]?.building_id;

                if (!buildingId) {
                    throw new Error(`Failed to create building: ${dto.building}`);
                }

                preFetchedData.buildings.set(dto.building.toLowerCase(), buildingId);
                console.log(`[INFO] Created new building: "${dto.building}" (id: ${buildingId}) for inst_id: ${instId}`);
            }

            // หาหรือสร้าง room_location
            const roomKey = `${dto.building.toLowerCase()}|${dto.classroom.toLowerCase()}`;
            let roomLocationId = preFetchedData.rooms.get(roomKey);

            if (!roomLocationId) {
                // สร้างห้องใหม่
                const insertRoomQuery = `
                    INSERT INTO room_location (building_id, room_number, floor, flag_valid)
                    VALUES ($1, $2, $3, true)
                    RETURNING room_location_id
                `;
                const roomResult = await queryRunner.manager.query(insertRoomQuery, [
                    buildingId,
                    dto.classroom,
                    '0' // default floor
                ]);
                roomLocationId = roomResult[0]?.room_location_id;

                if (!roomLocationId) {
                    throw new Error(`Failed to create room: ${dto.classroom}`);
                }

                preFetchedData.rooms.set(roomKey, roomLocationId);
                console.log(`[INFO] Created new room: "${dto.classroom}" in building "${dto.building}" (id: ${roomLocationId})`);
            }

            // Map day of week
            const dayOfWeek = this.mapDayOfWeek(dto.day);
            if (dayOfWeek === null) {
                throw new BadRequestException(`วัน "${dto.day}" ไม่ถูกต้อง`);
            }

            const insertSectionQuery = `
                INSERT INTO section (subject_id, semester_id, section_name, flag_valid, created_at, updated_at)
                VALUES ($1, $2, $3, true, NOW(), NOW())
                RETURNING section_id
            `;
            const sectionResult = await queryRunner.manager.query(insertSectionQuery, [
                subjectId,
                semesterId,
                dto.sectionName
            ]);
            const sectionId = sectionResult[0]?.section_id;

            if (!sectionId) {
                throw new Error(`Failed to create section: ${dto.sectionName}`);
            }

            const insertScheduleQuery = `
                INSERT INTO section_schedule (section_id, day_of_week, start_time, end_time, room_location_id, flag_valid)
                VALUES ($1, $2, $3, $4, $5, true)
            `;
            await queryRunner.manager.query(insertScheduleQuery, [
                sectionId,
                dayOfWeek,
                dto.startTime,
                dto.endTime,
                roomLocationId
            ]);

            if (dto.mainTeacherCode) {
                const mainTeacherId = preFetchedData.teachers.get(dto.mainTeacherCode.toLowerCase());
                if (mainTeacherId) {
                    const insertMainTeacherQuery = `
                        INSERT INTO section_educator (section_id, educator_id, position, flag_valid)
                        VALUES ($1, $2, $3, true)
                    `;
                    await queryRunner.manager.query(insertMainTeacherQuery, [
                        sectionId,
                        mainTeacherId,
                        EducatorPosition.MAIN_TEACHER
                    ]);
                }
            }

            if (dto.coTeacherCode) {
                const coTeacherId = preFetchedData.teachers.get(dto.coTeacherCode.toLowerCase());
                if (coTeacherId) {
                    const insertCoTeacherQuery = `
                        INSERT INTO section_educator (section_id, educator_id, position, flag_valid)
                        VALUES ($1, $2, $3, true)
                    `;
                    await queryRunner.manager.query(insertCoTeacherQuery, [
                        sectionId,
                        coTeacherId,
                        EducatorPosition.CO_TEACHER
                    ]);
                }
            }

            if (dto.taCode) {
                const taId = preFetchedData.teachers.get(dto.taCode.toLowerCase());
                if (taId) {
                    const insertTaQuery = `
                        INSERT INTO section_educator (section_id, educator_id, position, flag_valid)
                        VALUES ($1, $2, $3, true)
                    `;
                    await queryRunner.manager.query(insertTaQuery, [
                        sectionId,
                        taId,
                        EducatorPosition.TA
                    ]);
                }
            }

            preFetchedData.existingSections.add(sectionKey);

            savedCount++;
            console.log(`[INFO] Created section "${dto.sectionName}" for subject "${dto.subjectCode}"`);
        }

        return { savedCount, skippedCount };
    }

    async saveSectionScheduleData(instId: number, semesterId: number, buffer: Buffer, validationToken?: string) {
        if (!validationToken) {
            throw new BadRequestException('กรุณา validate ข้อมูลก่อนบันทึก (ต้องระบุ validationToken)');
        }

        const rawData = await parseExcelFile(buffer);

        console.log(`[DEBUG] Saving section schedules for inst_id: ${instId}, semester_id: ${semesterId}`);

        const payload = verifyValidationToken(
            this.jwtService,
            validationToken,
            'section-schedule',
            instId,
            rawData
        );

        console.log(`[INFO] Valid token - proceeding to save ${payload.validCount} records (${payload.duplicateCount || 0} duplicates will be skipped)`);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let totalSavedCount = 0;
        let totalSkippedCount = 0;
        const allNewBuildings: string[] = [];
        const allNewRooms: string[] = [];

        try {
            // ตรวจสอบสถาบัน
            const inst = await queryRunner.manager.findOne('Institution', {
                where: { inst_id: instId }
            }) as any;
            if (!inst) {
                throw new NotFoundException(`สถาบันที่มี id ${instId} ไม่พบในระบบ`);
            }

            // Pre-fetch ข้อมูลทั้งหมด
            const preFetchedData = await this.preFetchData(instId, semesterId);

            const batches = chunkArray(rawData, IMPORT_BATCH_SIZE);
            console.log(`[INFO] Saving ${rawData.length} records in ${batches.length} batches`);

            for (let i = 0; i < batches.length; i++) {
                console.log(`[INFO] Processing batch ${i + 1}/${batches.length}`);
                const { savedCount, skippedCount } = await this.saveBatch(
                    batches[i],
                    queryRunner,
                    preFetchedData,
                    instId,
                    semesterId
                );
                totalSavedCount += savedCount;
                totalSkippedCount += skippedCount;
            }

            await queryRunner.commitTransaction();

            const uniqueNewBuildings = [...new Set(allNewBuildings)];
            const uniqueNewRooms = [...new Set(allNewRooms)];

            const result = {
                count: totalSavedCount,
                skippedCount: totalSkippedCount,
                skippedReason: totalSkippedCount > 0 ? 'ข้อมูลซ้ำในระบบ' : null,
                newBuildings: uniqueNewBuildings.length > 0 ? uniqueNewBuildings : null,
                newRooms: uniqueNewRooms.length > 0 ? uniqueNewRooms : null
            }
            
            return {
                success: true,
                message: `นำเข้าข้อมูลตารางเรียนสำเร็จ ${totalSavedCount} รายการ`,
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