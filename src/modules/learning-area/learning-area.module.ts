// learning-area.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningAreaController } from './learning-area.controller';
import { LearningAreaService } from './learning-area.service';
import { LearningArea } from './entities/learning-area.entity';
import { UserSysLearningAreaNormalize } from './entities/user-sys-learning-area-normalize.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LearningArea, UserSysLearningAreaNormalize])],
  controllers: [LearningAreaController],
  providers: [LearningAreaService],
  exports: [LearningAreaService],
})
export class LearningAreaModule {}
