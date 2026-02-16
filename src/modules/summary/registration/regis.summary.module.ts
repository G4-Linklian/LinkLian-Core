// regis.summary.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegisSummaryController } from './regis.summary.controller';
import { RegisSummaryService } from './regis.summary.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [RegisSummaryController],
  providers: [RegisSummaryService],
  exports: [RegisSummaryService],
})
export class RegisSummaryModule {}
