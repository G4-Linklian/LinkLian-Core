// filepath: /Users/thunyatorn/Desktop/LinkLian-Core/src/modules/social-feed/class-info/class-info.module.ts
import { Module } from '@nestjs/common';
import { ClassInfoController } from './class-info.controller';
import { ClassInfoService } from './class-info.service';

@Module({
  controllers: [ClassInfoController],
  providers: [ClassInfoService],
  exports: [ClassInfoService],
})
export class ClassInfoModule {}
