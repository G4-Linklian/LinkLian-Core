import {
	Body,
	Controller,
	Delete,
	Get,
	Post,
	Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QALiveService as QAUpvoteService } from './qa_upvote.service';
import {
	CreateUpvoteDto,
	DeleteUpvoteDto,
	SearchUpvoteDto,
} from './dto/qa_upvote.dto';

@ApiTags('QA Upvote')
@Controller('qa/upvote')
export class QAUpvoteController {
	constructor(private readonly qaUpvoteService: QAUpvoteService) { }

	@Get()
	@ApiOperation({ summary: 'Search question upvotes' })
	@ApiResponse({ status: 200, description: 'Question upvotes retrieved' })
	async searchUpvote(@Query() dto: SearchUpvoteDto) {
		return this.qaUpvoteService.searchUpvote(dto);
	}

	@Post()
	@ApiOperation({ summary: 'Create question upvote' })
	@ApiResponse({ status: 201, description: 'Question upvote created' })
	async createUpvote(@Body() dto: CreateUpvoteDto) {
		return this.qaUpvoteService.createUpvote(dto);
	}

	@Delete()
	@ApiOperation({ summary: 'Delete question upvote' })
	@ApiResponse({ status: 200, description: 'Question upvote deleted' })
	async deleteUpvote(@Body() dto: DeleteUpvoteDto) {
		return this.qaUpvoteService.deleteUpvote(dto);
	}
}
