import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportProgramController } from './import-program.controller';
import { ImportProgramService } from './import-program.service';
import { Program } from '../../program/entities/program.entity';
import { Institution } from '../../institution/entities/institution.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Program, Institution]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
                signOptions: { expiresIn: '30m' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [ImportProgramController],
    providers: [ImportProgramService],
    exports: [ImportProgramService],
})
export class ImportProgramModule { }