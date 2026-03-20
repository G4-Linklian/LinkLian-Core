import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'src/common/logger/logger.module';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
