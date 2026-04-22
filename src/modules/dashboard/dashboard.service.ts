import {
    Injectable,
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { SearchDashboardDto, ReportMonthDto } from './dto/dashboard.dto';
import { AppLogger } from '../../common/logger/app-logger.service';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(Dashboard)
        private dashboardRepo: Repository<Dashboard>,
        private readonly logger: AppLogger,
    ) { }

    async searchDashboard(dto: SearchDashboardDto) {
        const hasInput =
            dto.dashboard_id ||
            dto.user_sys_id ||
            dto.role_type ||
            dto.report_month ||
            typeof dto.flag_valid === 'boolean';

        if (!hasInput) {
            throw new BadRequestException('No value input!');
        }

        const queryBuilder = this.dashboardRepo.createQueryBuilder('md');

        if (dto.dashboard_id) {
            queryBuilder.andWhere('md.dashboard_id = :dashboardId', {
                dashboardId: dto.dashboard_id,
            });
        }

        if (dto.user_sys_id) {
            queryBuilder.andWhere('md.user_sys_id = :userSysId', {
                userSysId: dto.user_sys_id,
            });
        }

        if (dto.role_type) {
            queryBuilder.andWhere('md.role_type = :roleType', {
                roleType: dto.role_type,
            });
        }

        if (dto.report_month) {
            queryBuilder.andWhere('md.report_month = :reportMonth', {
                reportMonth: dto.report_month,
            });
        }

        if (typeof dto.flag_valid === 'boolean') {
            queryBuilder.andWhere('md.flag_valid = :flagValid', {
                flagValid: dto.flag_valid,
            });
        }

        queryBuilder.orderBy('md.report_month', 'DESC').addOrderBy('md.created_at', 'DESC');

        try {
            const result = await queryBuilder.getMany();
            return { success: true, data: result };
        } catch (error: unknown) {
            this.logger.error(
                'Error executing search dashboard query:',
                'DashboardService',
                error,
            );
            throw new InternalServerErrorException('Error fetching dashboard data');
        }
    }

    async findById(id: number) {
        const dashboard = await this.dashboardRepo.findOne({
            where: { dashboard_id: id },
        });

        if (!dashboard) {
            throw new NotFoundException('Dashboard not found');
        }

        return { success: true, data: dashboard };
    }

    async getReportMonths(dto: ReportMonthDto) {
        const queryBuilder = this.dashboardRepo.createQueryBuilder('md');

        if (dto.user_sys_id) {
            queryBuilder.andWhere('md.user_sys_id = :userSysId', {
                userSysId: dto.user_sys_id,
            });
        }

        queryBuilder
        .select('DISTINCT md.report_month', 'report_month')
        .orderBy('md.report_month', 'DESC');

        try {
            const rawResult = await queryBuilder.getRawMany();
            const result = rawResult.map((row) => row.report_month);
            
            return { success: true, data: result };
        } catch (error: unknown) {
            this.logger.error(
                'Error executing get report months query:',
                'DashboardService',
                error,
            );
            throw new InternalServerErrorException('Error fetching report months');
        }
    }
}

