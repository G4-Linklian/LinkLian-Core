import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportEnrollmentController } from './import-enrollment.controller';
import { ImportEnrollmentService } from './import-enrollment.service';
import { Section } from '../../section/entities/section.entity';
import { Enrollment } from '../../section/entities/enrollment.entity';
import { UserSys } from '../../users/entities/user-sys.entity';
import { Institution } from '../../institution/entities/institution.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Section, Enrollment, UserSys, Institution]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
        signOptions: { expiresIn: '30m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ImportEnrollmentController],
  providers: [ImportEnrollmentService],
  exports: [ImportEnrollmentService],
})
export class ImportEnrollmentModule {}
