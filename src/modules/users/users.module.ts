// users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserSys } from './entities/user-sys.entity';
import { LearningAreaModule } from '../learning-area/learning-area.module';
import { ProgramModule } from '../program/program.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserSys]),
    LearningAreaModule,
    ProgramModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
