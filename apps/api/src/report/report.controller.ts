import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('report')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('summary')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE, UserRoleEnum.TENANT_VIEWER)
  async getDailySummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.reportService.getDailyFinancialSummary(currentUser, startDate, endDate);
  }
}
