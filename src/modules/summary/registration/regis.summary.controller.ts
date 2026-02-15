// regis.summary.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisSummaryService } from './regis.summary.service';
import {
  RegisSummaryInfoDto,
  RegisSummaryCurriculumDto,
  RegisSummaryScheduleDto,
  RegisSummaryRegistrationDto,
} from './dto/regis.summary.dto';

@ApiTags('Registration Summary')
@Controller('summary/registration')
export class RegisSummaryController {
  constructor(private readonly regisSummaryService: RegisSummaryService) {}

  @Get('info')
  @ApiOperation({
    summary: 'ข้อมูลภาพรวมการลงทะเบียน',
    description: 'ดึงข้อมูลสรุปการลงทะเบียนทั่วไป',
  })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  @ApiResponse({ status: 400, description: 'พารามิเตอร์ไม่ถูกต้อง' })
  async getInfo(@Query() dto: RegisSummaryInfoDto) {
    const data = await this.regisSummaryService.getInfo(dto);
    return { success: true, data };
  }

  @Get('curriculum')
  @ApiOperation({
    summary: 'สรุปการลงทะเบียนตามหลักสูตร',
    description: 'ดึงข้อมูลสรุปการลงทะเบียนแยกตามหลักสูตร/โปรแกรม',
  })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  @ApiResponse({ status: 400, description: 'พารามิเตอร์ไม่ถูกต้อง' })
  async getCurriculum(@Query() dto: RegisSummaryCurriculumDto) {
    const data = await this.regisSummaryService.getCurriculum(dto);
    return { success: true, data };
  }

  @Get('schedule')
  @ApiOperation({
    summary: 'สรุปการลงทะเบียนตามตารางเรียน',
    description: 'ดึงข้อมูลสรุปการลงทะเบียนแยกตาม section และวิชา',
  })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  @ApiResponse({ status: 400, description: 'พารามิเตอร์ไม่ถูกต้อง' })
  async getSchedule(@Query() dto: RegisSummaryScheduleDto) {
    const data = await this.regisSummaryService.getSchedule(dto);
    return { success: true, data };
  }

  @Get('registration')
  @ApiOperation({
    summary: 'สรุปสถานะการลงทะเบียน',
    description: 'ดึงข้อมูลสรุปสถานะการลงทะเบียนของนักเรียน',
  })
  @ApiResponse({ status: 200, description: 'สำเร็จ' })
  @ApiResponse({ status: 400, description: 'พารามิเตอร์ไม่ถูกต้อง' })
  async getRegistration(@Query() dto: RegisSummaryRegistrationDto) {
    const data = await this.regisSummaryService.getRegistration(dto);
    return { success: true, data };
  }
}
