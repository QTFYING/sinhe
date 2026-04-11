import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type {
  AnalyticsDashboardResponse,
  DailyTrendItem,
  LiveFeedEntryItem,
  MonthlyTrendItem,
} from '@shou/types/contracts';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsRangeQueryDto } from './dto/analytics-range.query.dto';
import { ReportService } from './report.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('daily-trend')
  @Roles(
    UserRoleEnum.TENANT_OWNER,
    UserRoleEnum.TENANT_OPERATOR,
    UserRoleEnum.TENANT_FINANCE,
    UserRoleEnum.TENANT_VIEWER,
  )
  async getDailyTrend(@CurrentUser() currentUser: JwtPayload): Promise<DailyTrendItem[]> {
    return this.reportService.getDailyTrend(currentUser);
  }

  @Get('monthly-trend')
  @Roles(
    UserRoleEnum.TENANT_OWNER,
    UserRoleEnum.TENANT_OPERATOR,
    UserRoleEnum.TENANT_FINANCE,
    UserRoleEnum.TENANT_VIEWER,
  )
  async getMonthlyTrend(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: AnalyticsRangeQueryDto,
  ): Promise<MonthlyTrendItem[]> {
    return this.reportService.getMonthlyTrend(currentUser, query.months);
  }

  @Get('payments/live')
  @Roles(
    UserRoleEnum.TENANT_OWNER,
    UserRoleEnum.TENANT_OPERATOR,
    UserRoleEnum.TENANT_FINANCE,
    UserRoleEnum.TENANT_VIEWER,
  )
  async getLivePayments(@CurrentUser() currentUser: JwtPayload): Promise<LiveFeedEntryItem[]> {
    return this.reportService.getLivePayments(currentUser);
  }

  @Get('dashboard')
  @Roles(
    UserRoleEnum.TENANT_OWNER,
    UserRoleEnum.TENANT_OPERATOR,
    UserRoleEnum.TENANT_FINANCE,
    UserRoleEnum.TENANT_VIEWER,
  )
  async getDashboard(@CurrentUser() currentUser: JwtPayload): Promise<AnalyticsDashboardResponse> {
    return this.reportService.getDashboard(currentUser);
  }
}
