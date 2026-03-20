import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { AssetEntity } from './entities/asset.entity';
import { LoggerModule } from '../../common/logger/logger.module';
import { FileStorageModule } from '../file-storage/file-storage.module';

@Module({
    imports: [TypeOrmModule.forFeature([AssetEntity]), LoggerModule, FileStorageModule],
    controllers: [AssetController],
    providers: [AssetService],
})
export class AssetsModule { }
