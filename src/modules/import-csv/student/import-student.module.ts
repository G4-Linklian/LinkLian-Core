import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportStudentController } from './import-student.controller';
import { ImportStudentService } from './import-student.service';
import { UserSys } from '../../users/entities/user-sys.entity';
import { EduLevel } from '../../edu-level/entities/edu-level.entity';
import { Program } from '../../program/entities/program.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSys, EduLevel, Program]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
        signOptions: { expiresIn: '30m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ImportStudentController],
  providers: [ImportStudentService],
  exports: [ImportStudentService],
})
export class ImportStudentModule {}
