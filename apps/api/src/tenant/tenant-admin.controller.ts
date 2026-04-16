import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import type {
  CreateTenantAuditBatchRequest,
  CreateTenantAuditDecisionRequest,
  TenantAuditDecisionResponse,
  CreateTenantCertificationReviewDecisionRequest,
  CreateTenantRenewalRequest,
  TenantRenewalResponse,
  CreateTenantRequest,
  CreateTenantStatusChangeBatchRequest,
  PatchTenantStatusRequest,
  TenantBatchActionResponse,
  TenantCertificationRecordItem,
  TenantCertificationReviewDecisionResponse,
  TenantListQuery,
  TenantMemberItem,
  TenantMemberListQuery,
  TenantRecordItem,
  TenantStatusMutationResponse,
} from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTenantAdminDto } from './dto/create-tenant-admin.dto';
import { CreateTenantAuditBatchDto } from './dto/create-tenant-audit-batch.dto';
import { CreateTenantAuditDecisionDto } from './dto/create-tenant-audit-decision.dto';
import { CreateTenantCertificationReviewDecisionDto } from './dto/create-tenant-certification-review-decision.dto';
import { CreateTenantRenewalDto } from './dto/create-tenant-renewal.dto';
import { CreateTenantStatusChangeBatchDto } from './dto/create-tenant-status-change-batch.dto';
import { ListTenantMembersQueryDto } from './dto/list-tenant-members.query.dto';
import { ListTenantsQueryDto } from './dto/list-tenants.query.dto';
import { PatchTenantStatusDto } from './dto/patch-tenant-status.dto';
import { TenantService } from './tenant.service';
import {
  TenantAuditDecisionResponseSwagger,
  TenantBatchActionResponseSwagger,
  TenantCertificationRecordItemSwagger,
  TenantCertificationReviewDecisionResponseSwagger,
  TenantListResponseSwagger,
  TenantMemberListResponseSwagger,
  TenantRecordItemSwagger,
  TenantRenewalResponseSwagger,
  TenantStatusMutationResponseSwagger,
} from './tenant.swagger';

@ApiTags('Admin Tenants')
@ApiBearerAuth()
@ApiExtraModels(
  TenantListResponseSwagger,
  TenantRecordItemSwagger,
  TenantAuditDecisionResponseSwagger,
  TenantBatchActionResponseSwagger,
  TenantRenewalResponseSwagger,
  TenantStatusMutationResponseSwagger,
  TenantMemberListResponseSwagger,
  TenantCertificationRecordItemSwagger,
  TenantCertificationReviewDecisionResponseSwagger,
)
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantAdminController {
  constructor(private readonly tenantService: TenantService) {}

  @ApiOperation({ summary: '获取租户列表' })
  @ApiOkResponse({ type: TenantListResponseSwagger })
  @Get()
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async getTenants(
    @Query() query: ListTenantsQueryDto,
  ): Promise<PaginatedResponse<TenantRecordItem>> {
    return this.tenantService.getTenants(query as TenantListQuery);
  }

  @ApiOperation({ summary: '创建租户' })
  @ApiOkResponse({ type: TenantRecordItemSwagger })
  @Post()
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createTenant(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateTenantAdminDto,
    @Ip() ip: string,
  ): Promise<TenantRecordItem> {
    return this.tenantService.createAdminTenant(
      currentUser,
      request as CreateTenantRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '创建租户审核决议' })
  @ApiParam({ name: 'id', description: '租户 ID' })
  @ApiOkResponse({ type: TenantAuditDecisionResponseSwagger })
  @Post(':id/audit-decisions')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createAuditDecision(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') tenantId: string,
    @Body() request: CreateTenantAuditDecisionDto,
    @Ip() ip: string,
  ): Promise<TenantAuditDecisionResponse> {
    return this.tenantService.createTenantAuditDecision(
      currentUser,
      tenantId,
      request as CreateTenantAuditDecisionRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '创建租户批量审核批次' })
  @ApiOkResponse({ type: TenantBatchActionResponseSwagger })
  @Post('audit-batches')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createAuditBatch(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateTenantAuditBatchDto,
    @Ip() ip: string,
  ): Promise<TenantBatchActionResponse> {
    return this.tenantService.createTenantAuditBatch(
      currentUser,
      request as CreateTenantAuditBatchRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '创建租户续费记录' })
  @ApiParam({ name: 'id', description: '租户 ID' })
  @ApiOkResponse({ type: TenantRenewalResponseSwagger })
  @Post(':id/renewals')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createRenewal(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') tenantId: string,
    @Body() request: CreateTenantRenewalDto,
    @Ip() ip: string,
  ): Promise<TenantRenewalResponse> {
    return this.tenantService.createTenantRenewal(
      currentUser,
      tenantId,
      request as CreateTenantRenewalRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '更新租户状态' })
  @ApiParam({ name: 'id', description: '租户 ID' })
  @ApiOkResponse({ type: TenantStatusMutationResponseSwagger })
  @Patch(':id')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async patchStatus(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') tenantId: string,
    @Body() request: PatchTenantStatusDto,
    @Ip() ip: string,
  ): Promise<TenantStatusMutationResponse> {
    return this.tenantService.patchTenantStatus(
      currentUser,
      tenantId,
      request as PatchTenantStatusRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '创建租户批量状态变更批次' })
  @ApiOkResponse({ type: TenantBatchActionResponseSwagger })
  @Post('status-change-batches')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createStatusChangeBatch(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateTenantStatusChangeBatchDto,
    @Ip() ip: string,
  ): Promise<TenantBatchActionResponse> {
    return this.tenantService.createTenantStatusChangeBatch(
      currentUser,
      request as CreateTenantStatusChangeBatchRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '获取组织架构成员列表' })
  @ApiOkResponse({ type: TenantMemberListResponseSwagger })
  @Get('members')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async getMembers(
    @Query() query: ListTenantMembersQueryDto,
  ): Promise<PaginatedResponse<TenantMemberItem>> {
    return this.tenantService.getTenantMembers(query as TenantMemberListQuery);
  }

  @ApiOperation({ summary: '获取资质审核队列' })
  @ApiOkResponse({ type: [TenantCertificationRecordItemSwagger] })
  @Get('certifications')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async getCertificationQueue(): Promise<TenantCertificationRecordItem[]> {
    return this.tenantService.getCertificationQueue();
  }

  @ApiOperation({ summary: '创建资质审核决议' })
  @ApiParam({ name: 'id', description: '资质记录 ID' })
  @ApiOkResponse({ type: TenantCertificationReviewDecisionResponseSwagger })
  @Post('certifications/:id/review-decisions')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createCertificationReviewDecision(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') certificationId: string,
    @Body() request: CreateTenantCertificationReviewDecisionDto,
    @Ip() ip: string,
  ): Promise<TenantCertificationReviewDecisionResponse> {
    return this.tenantService.createCertificationReviewDecision(
      currentUser,
      certificationId,
      request as CreateTenantCertificationReviewDecisionRequest,
      ip,
    );
  }
}
