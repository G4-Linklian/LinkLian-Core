import { Injectable } from '@nestjs/common';
import { AppLogger } from 'src/common/logger/app-logger.service';
import { RabbitMQService } from 'src/common/rabbitmq/rabbitmq.service';
import { ChatNotiEvent } from 'src/modules/chat/dto/chat.dto';

export interface ChatNotiPayloadInput {
	refId: string;
	senderId: string;
	body: string;
	targetUserSysIds: string[];
	createdAt?: Date;
	title?: string;
}

@Injectable()
export class RabbitNotiService {
	constructor(
		private readonly logger: AppLogger,
		private readonly rabbitMQService: RabbitMQService,
	) {}

	async sendChatNotification(payload: ChatNotiPayloadInput): Promise<void> {
		const eventMessage: ChatNotiEvent = {
			type: 'SEND_NOTIFICATION',
			payload: {
				ref_id: payload.refId,
				sender_id: payload.senderId,
				title: payload.title ?? 'You have a new message',
				body: payload.body,
				target_user_sys_ids: payload.targetUserSysIds,
				created_at: payload.createdAt || new Date(),
			},
		};

		this.logger.debug(
			'Publishing chat notification to RabbitMQ:',
			'RabbitNotiService',
			eventMessage,
		);

		await this.rabbitMQService.publish(
			'linklian_events',
			'notification.chat',
			eventMessage,
		);

		this.logger.debug(
			'Chat notification published to RabbitMQ successfully',
			'RabbitNotiService',
		);
	}
}
