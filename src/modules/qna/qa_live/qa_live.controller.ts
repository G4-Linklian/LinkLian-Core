import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Post,
	Put,
	Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QALiveService } from './qa_live.service';
import {
	CreateQALiveDto,
	CreateQALiveLogDto,
	SearchQALiveDto,
	SearchQALiveLogDto,
	SearchSectionFilesDto,
	UpdateQALiveDto,
} from './dto/qa_live.dto';

@ApiTags('QA Live')
@Controller('qa/live')
export class QALiveController {
	constructor(private readonly qaLiveService: QALiveService) { }

	@Get()
	@ApiOperation({ summary: 'Search QA live sessions' })
	@ApiResponse({ status: 200, description: 'QA live sessions retrieved' })
	async searchQALive(@Query() dto: SearchQALiveDto) {
		return this.qaLiveService.searchQALive(dto);
	}

	@Post()
	@ApiOperation({ summary: 'Create QA live session' })
	@ApiResponse({ status: 201, description: 'QA live session created' })
	async createQALive(@Body() dto: CreateQALiveDto) {
		return this.qaLiveService.createQALive(dto);
	}

	@Get('log')
	@ApiOperation({ summary: 'Search QA live logs' })
	@ApiResponse({ status: 200, description: 'QA live logs retrieved' })
	async searchQALiveLog(@Query() dto: SearchQALiveLogDto) {
		return this.qaLiveService.searchQALiveLog(dto);
	}

	@Post('log')
	@ApiOperation({ summary: 'Create QA live log (switch file)' })
	@ApiResponse({ status: 201, description: 'QA live log created' })
	async createQALiveLog(@Body() dto: CreateQALiveLogDto) {
		return this.qaLiveService.createQALiveLog(dto);
	}

	@Get('section/:section_id/files')
	@ApiOperation({ summary: 'Get section files for QA live presenter' })
	@ApiResponse({ status: 200, description: 'Section files retrieved' })
	async searchSectionFiles(
		@Param('section_id', ParseIntPipe) section_id: number,
		@Query() dto: SearchSectionFilesDto,
	) {
		return this.qaLiveService.searchSectionFiles(section_id, dto);
	}

	@Get('section/:section_id/active-live')
	@ApiOperation({ summary: 'Get active QA live session for a section' })
	@ApiResponse({ status: 200, description: 'Active QA live session retrieved' })
	async getActiveSectionFiles(@Param('section_id', ParseIntPipe) section_id: number) {
		return this.qaLiveService.findActiveLive(section_id);
	}

	@Get(':id')
	@ApiOperation({ summary: 'Get QA live by ID' })
	@ApiResponse({ status: 200, description: 'QA live found' })
	async findQALiveById(@Param('id', ParseIntPipe) id: number) {
		return this.qaLiveService.findQALiveById(id);
	}

	@Put(':id')
	@ApiOperation({ summary: 'Update QA live session' })
	@ApiResponse({ status: 200, description: 'QA live session updated' })
	async updateQALive(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateQALiveDto,
	) {
		return this.qaLiveService.updateQALive(id, dto);
	}

	@Get('log/:id')
	@ApiOperation({ summary: 'Get QA live log by ID' })
	@ApiResponse({ status: 200, description: 'QA live log found' })
	async findQALiveLogById(@Param('id', ParseIntPipe) id: number) {
		return this.qaLiveService.findQALiveLogById(id);
	}

	@Get(':id/current-log')
	@ApiOperation({ summary: 'Get current active log by QA live ID' })
	@ApiResponse({ status: 200, description: 'Current log found' })
	async getCurrentLog(@Param('id', ParseIntPipe) id: number) {
		return this.qaLiveService.getCurrentLog(id);
	}
}
