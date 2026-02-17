import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportSectionScheduleController } from './import-section-schedule.controller';
import { ImportSectionScheduleService } from './import-section-schedule.service';
import { UserSys } from '../../users/entities/user-sys.entity';
import { Subject } from '../../subject/entities/subject.entity';
import { Section } from '../../section/entities/section.entity';
import { SectionSchedule } from '../../section/entities/section-schedule.entity';
import { SectionEducator } from '../../section/entities/section-educator.entity';
import { Institution } from '../../institution/entities/institution.entity';
import { Semester } from '../../semester/entities/semester.entity';
import { Building } from '../../building/entities/building.entity';
import { RoomLocation } from '../../room-location/entities/room-location.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            UserSys,
            Subject,
            Section,
            SectionSchedule,
            SectionEducator,
            Institution,
            Semester,
            Building,
            RoomLocation
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
                signOptions: { expiresIn: '30m' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [ImportSectionScheduleController],
    providers: [ImportSectionScheduleService],
    exports: [ImportSectionScheduleService],
})
export class ImportSectionScheduleModule {}