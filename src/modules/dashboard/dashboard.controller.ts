import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { SearchDashboardDto } from './dto/dashboard.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
	constructor(private readonly dashboardService: DashboardService) {}

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
