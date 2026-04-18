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
import { InstitutionReportService } from './institution-report.service';
import {
  CreateInstitutionReportDto,
  SearchInstitutionReportDto,
  UpdateInstitutionReportDto,
} from './dto/institution-report.dto';

@ApiTags('Report - Institution')
@Controller('report/institution')
export class InstitutionReportController {
  constructor(
    private readonly institutionReportService: InstitutionReportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Search institution reports',
    description: 'Search institution reports by filter conditions',
  })
  @ApiResponse({ status: 200, description: 'Success' })
  async getInstitutionReports(@Query() dto: SearchInstitutionReportDto) {
    return this.institutionReportService.searchInstitutionReport(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get institution report by ID',
    description: 'Get institution report details by ID',
  })
  @ApiParam({ name: 'id', description: 'Institution report ID', type: Number })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Institution report not found' })
  async getInstitutionReportById(@Param('id') id: number) {
    return this.institutionReportService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create institution report',
    description: 'Create a new report from institution side',
  })
  @ApiBody({ type: CreateInstitutionReportDto })
  @ApiResponse({ status: 201, description: 'Created' })
  async createInstitutionReport(@Body() dto: CreateInstitutionReportDto) {
    return this.institutionReportService.createInstitutionReport(dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update institution report',
    description: 'Update institution report by ID',
  })
  @ApiParam({ name: 'id', description: 'Institution report ID', type: Number })
  @ApiBody({ type: UpdateInstitutionReportDto })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Institution report not found' })
  async updateInstitutionReport(
    @Param('id') id: number,
    @Body() dto: UpdateInstitutionReportDto,
  ) {
    return this.institutionReportService.updateInstitutionReport(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete institution report',
    description: 'Delete institution report by ID',
  })
  @ApiParam({ name: 'id', description: 'Institution report ID', type: Number })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Institution report not found' })
  async deleteInstitutionReport(@Param('id') id: number) {
    return this.institutionReportService.deleteInstitutionReport(id);
  }
}
