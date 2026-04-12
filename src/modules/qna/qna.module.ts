import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RabbitMQModule } from 'src/common/rabbitmq/rabbitmq.module';
import { RedisModule } from 'src/common/redis/redis.module';
import { BullMQModule } from 'src/common/bullmq/bullmq.module';
import { QALiveController } from './qa_live/qa_live.controller';
import { QALiveService } from './qa_live/qa_live.service';
import { QALive } from './qa_live/entities/qa_live.entity';
import { QALiveLog } from './qa_live/entities/qa_live_log.entity';
import { QAQuestionController } from './qa_question/qa_quesetion.controller';
import { QALiveService as QAQuestionService } from './qa_question/qa_question.service';
import { QAQuestion } from './qa_question/entities/qa_question.entity';
import { QAUpvoteController } from './qa_upvote/qa_upvote.controller';
import { QALiveService as QAUpvoteService } from './qa_upvote/qa_upvote.service';
import { QaQuestionUpvote } from './qa_upvote/entities/qa_question_upvote.entity';
import { QnaRedisService } from './redis/qna-redis.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			QALive,
			QALiveLog,
			QAQuestion,
			QaQuestionUpvote,
		]),
		LoggerModule,
		RabbitMQModule,
		RedisModule,
		BullMQModule,
	],
	controllers: [QALiveController, QAQuestionController, QAUpvoteController],
	providers: [QALiveService, QAQuestionService, QAUpvoteService, QnaRedisService],
	exports: [QALiveService, QAQuestionService, QAUpvoteService, QnaRedisService],
})
export class QnaModule { }
