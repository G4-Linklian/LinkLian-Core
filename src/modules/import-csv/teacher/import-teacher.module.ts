import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportTeacherController } from './import-teacher.controller';
import { ImportTeacherService } from './import-teacher.service';
import { UserSys } from '../../users/entities/user-sys.entity';
import { LearningArea } from 'src/modules/learning-area/entities/learning-area.entity';
import { ImportStudentController } from '../student/import-student.controller';
import { ImportStudentService } from '../student/import-student.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([UserSys, LearningArea]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
                signOptions: { expiresIn: '30m' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [ImportTeacherController],
    providers: [ImportTeacherService],
    exports: [ImportTeacherService],
})
export class ImportTeacherModule {}
