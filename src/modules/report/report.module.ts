import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminReport } from './admin/entities/admin-report.entity';
import { InstitutionReport } from './institution/entities/institution-report.entity';
import { AdminReportController } from './admin/admin-report.controller';
import { InstitutionReportController } from './institution/institution-report.controller';
import { AdminReportService } from './admin/admin-report.service';
import { InstitutionReportService } from './institution/institution-report.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminReport, InstitutionReport])],
  controllers: [AdminReportController, InstitutionReportController],
  providers: [AdminReportService, InstitutionReportService],
  exports: [AdminReportService, InstitutionReportService],
})
export class ReportModule {}
