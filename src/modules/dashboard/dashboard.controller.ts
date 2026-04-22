import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { SearchDashboardDto, ReportMonthDto } from './dto/dashboard.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
	constructor(private readonly dashboardService: DashboardService) {}

	@Get('report-month')
	@ApiOperation({ summary: 'Get distinct report months' })
	@ApiResponse({ status: 200, description: 'Report months retrieved successfully' })
	async getReportMonths(@Query() dto: ReportMonthDto) {
		const data = await this.dashboardService.getReportMonths(dto);
		return data;
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get dashboard row by ID' })
	@ApiResponse({ status: 200, description: 'Dashboard found' })
	@ApiResponse({ status: 404, description: 'Dashboard not found' })
	async findById(@Param('id', ParseIntPipe) id: number) {
		const data = await this.dashboardService.findById(id);
		return data;
	}

	@Get()
	@ApiOperation({ summary: 'Search dashboard rows by filters (including role_type)' })
	@ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
	@ApiResponse({ status: 400, description: 'No search parameters provided' })
	async searchDashboard(@Query() dto: SearchDashboardDto) {
		const data = await this.dashboardService.searchDashboard(dto);
		return data;
	}
}

