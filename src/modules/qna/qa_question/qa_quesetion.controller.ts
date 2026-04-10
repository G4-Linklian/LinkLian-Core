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
import { QALiveService as QAQuestionService } from './qa_question.service';
import {
	CreateQuestionDto,
	SearchQuestionDto,
	UpdateQuestionDto,
} from './dto/qa_question.dto';

@ApiTags('QA Question')
@Controller('qa/question')
export class QAQuestionController {
	constructor(private readonly qaQuestionService: QAQuestionService) { }

	@Get(':id')
	@ApiOperation({ summary: 'Get QA question by ID' })
	@ApiResponse({ status: 200, description: 'QA question found' })
	async findQuestionById(@Param('id', ParseIntPipe) id: number) {
		return this.qaQuestionService.findQuestionById(id);
	}

	@Get()
	@ApiOperation({ summary: 'Search QA questions' })
	@ApiResponse({ status: 200, description: 'QA questions retrieved' })
	async searchQuestion(@Query() dto: SearchQuestionDto) {
		return this.qaQuestionService.searchQuestion(dto);
	}

	@Post()
	@ApiOperation({ summary: 'Create QA question' })
	@ApiResponse({ status: 201, description: 'QA question created' })
	async createQuestion(@Body() dto: CreateQuestionDto) {
		return this.qaQuestionService.createQuestion(dto);
	}

	@Put(':id')
	@ApiOperation({ summary: 'Update QA question' })
	@ApiResponse({ status: 200, description: 'QA question updated' })
	async updateQuestion(
		@Param('id', ParseIntPipe) id: number,
		@Body() dto: UpdateQuestionDto,
	) {
		return this.qaQuestionService.updateQuestion(id, dto);
	}
}
