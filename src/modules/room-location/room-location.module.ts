// room-location.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomLocationController } from './room-location.controller';
import { RoomLocationService } from './room-location.service';
import { RoomLocation } from './entities/room-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoomLocation])],
  controllers: [RoomLocationController],
  providers: [RoomLocationService],
  exports: [RoomLocationService],
})
export class RoomLocationModule {}
