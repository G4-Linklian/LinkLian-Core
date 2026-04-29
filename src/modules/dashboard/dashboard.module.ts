import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Dashboard } from './entities/dashboard.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Dashboard])],
	controllers: [DashboardController],
	providers: [DashboardService],
	exports: [DashboardService],
})
export class DashboardModule {}
