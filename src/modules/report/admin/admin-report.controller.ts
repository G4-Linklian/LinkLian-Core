import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminReportService } from './admin-report.service';
import {
  CreateAdminReportDto,
  SearchAdminReportDto,
  UpdateAdminReportDto,
} from './dto/admin-report.dto';

@ApiTags('Report - Admin')
@Controller('report/admin')
export class AdminReportController {
  constructor(private readonly adminReportService: AdminReportService) {}

  @Get()
  @ApiOperation({
    summary: 'Search admin reports',
    description: 'Search admin reports by filter conditions',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  async getAdminReports(@Query() dto: SearchAdminReportDto) {
    return this.adminReportService.searchAdminReport(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get admin report by ID',
    description: 'Get admin report details by ID',
  })
  @ApiParam({ name: 'id', description: 'Admin report ID', type: Number })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Admin report not found' })
  async getAdminReportById(@Param('id') id: number) {
    return this.adminReportService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create admin report',
    description: 'Create a new report from admin side',
  })
  @ApiBody({ type: CreateAdminReportDto })
  @ApiResponse({ status: 201, description: 'Created' })
  async createAdminReport(@Body() dto: CreateAdminReportDto) {
    return this.adminReportService.createAdminReport(dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update admin report',
    description: 'Update admin report by ID',
  })
  @ApiParam({ name: 'id', description: 'Admin report ID', type: Number })
  @ApiBody({ type: UpdateAdminReportDto })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Admin report not found' })
  async updateAdminReport(
    @Param('id') id: number,
    @Body() dto: UpdateAdminReportDto,
  ) {
    return this.adminReportService.updateAdminReport(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete admin report',
    description: 'Delete admin report by ID',
  })
  @ApiParam({ name: 'id', description: 'Admin report ID', type: Number })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Admin report not found' })
  async deleteAdminReport(@Param('id') id: number) {
    return this.adminReportService.deleteAdminReport(id);
  }
}
