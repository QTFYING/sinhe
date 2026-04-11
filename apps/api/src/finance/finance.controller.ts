import {
  Controller,
  Get,
  Header,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserRoleEnum } from '@prisma/client';
import type {
  AdminReconciliationDailyRecordItem,
  AdminReconciliationSummaryResponse,
  FinanceReconciliationRecordItem,
  FinanceSummaryResponse,
} from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListReconciliationQueryDto } from './dto/list-reconciliation.query.dto';
import { FinanceService } from './finance.service';

@ApiTags('Tenant Finance')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantFinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @ApiOperation({ summary: '获取财务汇总' })
  @Get('summary')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getSummary(@CurrentUser() currentUser: JwtPayload): Promise<FinanceSummaryResponse> {
    return this.financeService.getTenantSummary(currentUser);
  }

  @ApiOperation({ summary: '获取租户对账明细' })
  @Get('reconciliation')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getReconciliation(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListReconciliationQueryDto,
  ): Promise<PaginatedResponse<FinanceReconciliationRecordItem>> {
    return this.financeService.getTenantReconciliation(currentUser, query.page, query.pageSize);
  }

  @ApiOperation({ summary: '导出租户对账单' })
  @Get('reconciliation/export')
  @Header('Content-Type', 'application/octet-stream')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async exportReconciliation(
    @CurrentUser() currentUser: JwtPayload,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.financeService.exportTenantReconciliation(currentUser);
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(Buffer.from(file.content, 'utf-8'));
  }
}

@ApiTags('Admin Reconciliation')
@ApiBearerAuth()
@Controller('reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminReconciliationController {
  constructor(private readonly financeService: FinanceService) {}

  @ApiOperation({ summary: '获取平台对账汇总' })
  @Get('summary')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async getSummary(): Promise<AdminReconciliationSummaryResponse> {
    return this.financeService.getAdminSummary();
  }

  @ApiOperation({ summary: '获取平台对账日报明细' })
  @Get('daily')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async getDaily(
    @Query() query: ListReconciliationQueryDto,
  ): Promise<PaginatedResponse<AdminReconciliationDailyRecordItem>> {
    return this.financeService.getAdminDaily(query.page, query.pageSize);
  }

  @ApiOperation({ summary: '导出平台对账单' })
  @Get('export')
  @Header('Content-Type', 'application/octet-stream')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async export(@Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    const file = await this.financeService.exportAdminReconciliation();
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(Buffer.from(file.content, 'utf-8'));
  }
}
