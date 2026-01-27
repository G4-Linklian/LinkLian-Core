// semester.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SemesterController } from './semester.controller';
import { SemesterService } from './semester.service';
import { Semester } from './entities/semester.entity';
import { SemesterSubjectNormalize } from './entities/semester-subject-normalize.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Semester, SemesterSubjectNormalize])],
  controllers: [SemesterController],
  providers: [SemesterService],
  exports: [SemesterService],
})
export class SemesterModule {}
