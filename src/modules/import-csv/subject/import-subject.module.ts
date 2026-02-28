import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportSubjectController } from './import-subject.controller';
import { ImportSubjectService } from './import-subject.service';
import { LearningArea } from '../../learning-area/entities/learning-area.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningArea]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
        signOptions: { expiresIn: '30m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ImportSubjectController],
  providers: [ImportSubjectService],
  exports: [ImportSubjectService],
})
export class ImportSubjectModule {}
