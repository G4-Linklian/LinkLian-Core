// section.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SectionController } from './section.controller';
import { SectionService } from './section.service';
import { Section } from './entities/section.entity';
import { SectionSchedule } from './entities/section-schedule.entity';
import { SectionEducator } from './entities/section-educator.entity';
import { Enrollment } from './entities/enrollment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Section, SectionSchedule, SectionEducator, Enrollment])],
  controllers: [SectionController],
  providers: [SectionService],
  exports: [SectionService],
})
export class SectionModule {}
