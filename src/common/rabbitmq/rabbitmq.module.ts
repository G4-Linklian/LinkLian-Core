import { Global, Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { LoggerModule } from 'src/common/logger/logger.module';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [RabbitMQService],
  exports: [RabbitMQService],
})
export class RabbitMQModule {}
