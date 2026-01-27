// program.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgramController } from './program.controller';
import { ProgramService } from './program.service';
import { Program } from './entities/program.entity';
import { UserSysProgramNormalize } from './entities/user-sys-program-normalize.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Program, UserSysProgramNormalize])],
  controllers: [ProgramController],
  providers: [ProgramService],
  exports: [ProgramService],
})
export class ProgramModule {}
