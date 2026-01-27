// edu-level.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EduLevelController } from './edu-level.controller';
import { EduLevelService } from './edu-level.service';
import { EduLevel } from './entities/edu-level.entity';
import { EduLevelProgramNormalize } from './entities/edu-level-program-normalize.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EduLevel, EduLevelProgramNormalize])],
  controllers: [EduLevelController],
  providers: [EduLevelService],
  exports: [EduLevelService],
})
export class EduLevelModule {}
