import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AssetEntity } from './entities/asset.entity';
import { SearchAssetDto, CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';
import { AppLogger } from '../../common/logger/app-logger.service';
import { FileStorageService } from '../file-storage/file-storage.service';


@Injectable()
export class AssetService {
    constructor(
        @InjectRepository(AssetEntity)
        private assetRepo: Repository<AssetEntity>,
        private dataSource: DataSource,
        private readonly logger: AppLogger,
        private readonly fileStorageService: FileStorageService,
    ) { }

    async search(dto: SearchAssetDto) {
        await this.syncStatuses();

        const hasInput =
            dto.theme_id ||
            dto.theme_name ||
            dto.theme_url ||
            dto.start_date ||
            dto.end_date ||
            dto.status ||
            typeof dto.is_default === 'boolean' ||
            typeof dto.flag_valid === 'boolean';

        if (!hasInput) {
            throw new BadRequestException('No value input!');
        }

        try {
            const query = this.assetRepo.createQueryBuilder('ts');

            if (dto.theme_id) {
                query.andWhere('ts.theme_id = :themeId', { themeId: dto.theme_id });
            }

            if (dto.theme_name) {
                query.andWhere('ts.theme_name ILIKE :themeName', { themeName: `%${dto.theme_name}%` });
            }

            if (dto.theme_url) {
                query.andWhere('ts.theme_url ILIKE :themeUrl', { themeUrl: `%${dto.theme_url}%` });
            }

            if (dto.start_date && dto.end_date) {
                query
                    .andWhere('ts.start_date >= :startDate', { startDate: dto.start_date })
                    .andWhere('ts.end_date <= :endDate', { endDate: dto.end_date });
            } else if (dto.start_date) {
                query.andWhere('ts.start_date = :startDate', { startDate: dto.start_date });
            } else if (dto.end_date) {
                query.andWhere('ts.end_date = :endDate', { endDate: dto.end_date });
            }

            if (typeof dto.is_default === 'boolean') {
                query.andWhere('ts.is_default = :isDefault', { isDefault: dto.is_default });
            }

            if (typeof dto.flag_valid === 'boolean') {
                query.andWhere('ts.flag_valid = :flagValid', { flagValid: dto.flag_valid });
            }

            if (dto.status) {
                query.andWhere('ts.status = :status', { status: dto.status });
            }

            if (dto.sort_by) {
                const allowedSortFields = new Set([
                    'theme_id',
                    'theme_name',
                    'theme_url',
                    'start_date',
                    'end_date',
                    'is_default',
                    'flag_valid',
                    'status',
                ]);

                if (!allowedSortFields.has(dto.sort_by)) {
                    throw new BadRequestException('Invalid sort_by field');
                }

                const order = dto.sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
                query.orderBy(`ts.${dto.sort_by}`, order);
            }

            if (dto.limit) {
                query.limit(dto.limit);
            }

            if (dto.offset) {
                query.offset(dto.offset);
            }

            const [rows, totalCount] = await query.getManyAndCount();
            const result = rows.map((row) => ({ ...row, total_count: totalCount }));

            return { success: true, data: result };
        } catch (error: unknown) {
            this.logger.error('Error searching assets', 'SearchAsset', error);
            throw new InternalServerErrorException('Error fetching data');
        }
    }

    async findById(id: number) {
        const asset = await this.assetRepo
            .createQueryBuilder('ts')
            .where('ts.theme_id = :id', { id })
            .getOne();

        if (!asset) {
            throw new NotFoundException('Asset not found');
        }

        return { success: true, data: asset };
    }

    async create(dto: CreateAssetDto, file?: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('theme image file is required');
        }

        if (!file.mimetype?.startsWith('image/')) {
            throw new BadRequestException('Only image files are allowed');
        }

        try {
            const uploadResult = await this.fileStorageService.uploadFiles(
                'public-asset',
                'theme-setting',
                [file],
            );

            const theme_url = uploadResult.files?.[0]?.fileUrl;

            if (!theme_url) {
                throw new InternalServerErrorException('Error uploading theme image');
            }

            const saved = await this.dataSource.transaction(async (manager) => {
                if (dto.is_default === true) {
                    await manager
                        .createQueryBuilder()
                        .update(AssetEntity)
                        .set({ is_default: false })
                        .where('is_default = :isDefault', { isDefault: true })
                        .execute();
                }

                const insertResult = await manager
                    .createQueryBuilder()
                    .insert()
                    .into(AssetEntity)
                    .values({
                        theme_name: dto.theme_name,
                        theme_url,
                        start_date: dto.is_default === true
                            ? (null as unknown as Date)
                            : dto.start_date ? new Date(dto.start_date) : undefined,
                        end_date: dto.is_default === true
                            ? (null as unknown as Date)
                            : dto.end_date ? new Date(dto.end_date) : undefined,
                        is_default: dto.is_default,
                        flag_valid: dto.flag_valid,
                        status: dto.status ?? 'pending',
                    })
                    .returning('*')
                    .execute();

                return insertResult.raw[0];
            });

            return { success: true, data: saved, message: 'Asset created successfully' };
        } catch (error: unknown) {
            this.logger.error('Error creating asset', 'CreateAsset', error);
            throw new InternalServerErrorException('Error creating asset');
        }
    }

    async update(id: number, dto: UpdateAssetDto, file?: Express.Multer.File) {
        const existing = await this.assetRepo
            .createQueryBuilder('ts')
            .where('ts.theme_id = :id', { id })
            .getOne();

        if (!existing) {
            throw new NotFoundException('Asset not found');
        }

        if (file) {
            const uploadResult = await this.fileStorageService.uploadFiles(
                'public-asset',
                'theme-setting',
                [file],
            );
            dto.theme_url = uploadResult.files[0].fileUrl;
        }

        const updates: Partial<AssetEntity> = {};

        if (dto.theme_name !== undefined) 
            updates.theme_name = dto.theme_name;

        if (dto.theme_url !== undefined) 
            updates.theme_url = dto.theme_url;

        if (dto.start_date !== undefined) 
            updates.start_date = new Date(dto.start_date);

        if (dto.end_date !== undefined) 
            updates.end_date = new Date(dto.end_date);

        if (typeof dto.is_default === 'boolean') 
            updates.is_default = dto.is_default;

        if (typeof dto.flag_valid === 'boolean') 
            updates.flag_valid = dto.flag_valid;
        
        if (dto.status !== undefined) 
            updates.status = dto.status;

        if (dto.is_default === true) {
            updates.start_date = null as unknown as Date;
            updates.end_date = null as unknown as Date;
        }

        if (Object.keys(updates).length === 0) {
            throw new BadRequestException('No fields to update!');
        }

        try {
            await this.dataSource.transaction(async (manager) => {
                if (updates.is_default === true) {
                    await manager
                        .createQueryBuilder()
                        .update(AssetEntity)
                        .set({ is_default: false })
                        .where('is_default = :isDefault', { isDefault: true })
                        .andWhere('theme_id != :id', { id })
                        .execute();
                }

                await manager
                    .createQueryBuilder()
                    .update(AssetEntity)
                    .set(updates)
                    .where('theme_id = :id', { id })
                    .execute();
            });

            const updated = await this.assetRepo
                .createQueryBuilder('ts')
                .where('ts.theme_id = :id', { id })
                .getOne();

            return { success: true, data: updated, message: 'Asset updated successfully' };
        } catch (error: unknown) {
            this.logger.error('Error updating asset', 'UpdateAsset', error);
            throw new InternalServerErrorException('Error updating asset');
        }
    }

    async syncStatuses(): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            await this.assetRepo
                .createQueryBuilder()
                .update(AssetEntity)
                .set({
                    start_date: null as unknown as Date,
                    end_date: null as unknown as Date,
                })
                .where('is_default = :isDefault', { isDefault: true })
                .andWhere('(start_date IS NOT NULL OR end_date IS NOT NULL)')
                .execute();

            await this.assetRepo
                .createQueryBuilder()
                .update(AssetEntity)
                .set({
                    status: () => `CASE
                        WHEN start_date <= :today AND end_date >= :today THEN 'active'
                        WHEN is_default = true AND NOT EXISTS (
                            SELECT 1
                            FROM theme_setting t2
                            WHERE t2.flag_valid = true
                              AND t2.start_date <= :today
                              AND t2.end_date >= :today
                        ) THEN 'active'
                        WHEN end_date < :today THEN 'completed'
                        ELSE 'pending'
                    END`,
                })
                .where('flag_valid = :flagValid', { flagValid: true })
                .setParameter('today', today)
                .execute();

        } catch (error: unknown) {
            this.logger.error('Error syncing asset statuses', 'SyncStatuses', error);
            throw new BadRequestException('Error syncing asset status');
        }
    }

    async getActiveAsset() {
        await this.syncStatuses();

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

                        const activeAssets = await this.assetRepo
                                .createQueryBuilder('ts')
                                .where('ts.flag_valid = :flagValid', { flagValid: true })
                                .andWhere('ts.status = :status', { status: 'active' })
                                .andWhere('ts.start_date <= :today', { today })
                                .andWhere('ts.end_date >= :today', { today })
                                .orderBy('ts.theme_id', 'ASC')
                                .limit(1)
                                .getMany();

            if (activeAssets.length > 0) {
                return { success: true, data: activeAssets[0] };
            }

            const defaultAsset = await this.assetRepo
                .createQueryBuilder('ts')
                .where('ts.is_default = :isDefault', { isDefault: true })
                .andWhere('ts.flag_valid = :flagValid', { flagValid: true })
                .getOne();

            if (!defaultAsset) {
                throw new NotFoundException('No active or default asset found');
            }

            return { success: true, data: defaultAsset };
        } catch (error: unknown) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error('Error fetching active asset', 'GetActiveAsset', error);
            throw new InternalServerErrorException('Error fetching active asset');
        }
    }

    async getActiveThemeUrl(): Promise<string> {
        await this.syncStatuses();

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

                        const activeAssets = await this.assetRepo
                                .createQueryBuilder('ts')
                                .select('ts.theme_url', 'theme_url')
                                .where('ts.flag_valid = :flagValid', { flagValid: true })
                                .andWhere('ts.status = :status', { status: 'active' })
                                .andWhere('ts.start_date <= :today', { today })
                                .andWhere('ts.end_date >= :today', { today })
                                .orderBy('ts.theme_id', 'ASC')
                                .limit(1)
                                .getRawMany<{ theme_url: string }>();

            if (activeAssets.length > 0) {
                return activeAssets[0].theme_url;
            }

            const defaultAsset = await this.assetRepo
                .createQueryBuilder('ts')
                .select('ts.theme_url', 'theme_url')
                .where('ts.is_default = :isDefault', { isDefault: true })
                .andWhere('ts.flag_valid = :flagValid', { flagValid: true })
                .limit(1)
                .getRawOne<{ theme_url: string }>();

            if (!defaultAsset) {
                throw new NotFoundException('No active or default asset found');
            }

            return defaultAsset.theme_url;
        } catch (error: unknown) {
            if (error instanceof NotFoundException) throw error;
            this.logger.error('Error fetching active theme URL', 'GetActiveThemeUrl', error);
            throw new InternalServerErrorException('Error fetching active theme URL');
        }
    }

    async delete(id: number) {
        await this.syncStatuses();

        const existing = await this.assetRepo
            .createQueryBuilder('ts')
            .where('ts.theme_id = :id', { id })
            .getOne();

        if (!existing) {
            throw new NotFoundException('Asset not found');
        }

        if (existing.flag_valid === true && existing.status === 'active') {
            throw new BadRequestException({
                message: 'ไม่สามารถลบธีมที่กำลังใช้งานอยู่ได้ กรุณาเปลี่ยนสถานะหรือวันที่ให้ไม่ตรงกับวันที่ปัจจุบันก่อนลบ',
                data: existing,
            });
        }

        try {
            await this.assetRepo
                .createQueryBuilder()
                .delete()
                .from(AssetEntity)
                .where('theme_id = :id', { id })
                .execute();

            return { success: true, message: 'Asset deleted successfully' };
        } catch (error: unknown) {
            this.logger.error('Error deleting asset', 'DeleteAsset', error);
            throw new InternalServerErrorException('Error deleting asset');
        }
    }
}
