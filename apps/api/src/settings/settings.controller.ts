import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  PermissionNode,
  TenantAuditLogListResponse,
  GetPrintingConfigDetailResponse,
  GetPrintingConfigListResponse,
  TenantRoleAccount,
  TenantSettingsUser,
  TenantGeneralSettings,
  TenantUserStatusUpdateRequest,
  CreateTenantUserRequest,
  UpdateTenantGeneralSettingsRequest,
  UpdatePrintingConfigRequest,
  UpdatePrintingConfigResponse,
  UpdateTenantUserRequest,
} from '@shou/types/contracts';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';
import { PatchTenantUserStatusDto } from './dto/patch-tenant-user-status.dto';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';
import { UpdatePrintingConfigDto } from './dto/update-printing-config.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { SettingsService } from './settings.service';
import {
  GetPrintingConfigDetailResponseSwagger,
  GetPrintingConfigListResponseSwagger,
  PermissionNodeSwagger,
  TenantAuditLogListResponseSwagger,
  TenantGeneralSettingsSwagger,
  TenantRoleAccountSwagger,
  TenantSettingsUserSwagger,
  UpdatePrintingConfigResponseSwagger,
} from './settings.swagger';

@ApiTags('Tenant Settings')
@ApiBearerAuth()
@ApiExtraModels(
  TenantGeneralSettingsSwagger,
  TenantRoleAccountSwagger,
  PermissionNodeSwagger,
  TenantSettingsUserSwagger,
  GetPrintingConfigListResponseSwagger,
  GetPrintingConfigDetailResponseSwagger,
  UpdatePrintingConfigResponseSwagger,
  TenantAuditLogListResponseSwagger,
)
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiOperation({ summary: '获取通用配置' })
  @ApiOkResponse({ type: TenantGeneralSettingsSwagger })
  @Get('general')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getGeneralSettings(@CurrentUser() currentUser: JwtPayload): Promise<TenantGeneralSettings> {
    return this.settingsService.getGeneralSettings(currentUser);
  }

  @ApiOperation({ summary: '保存通用配置' })
  @ApiOkResponse({ type: TenantGeneralSettingsSwagger })
  @Put('general')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async updateGeneralSettings(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: UpdateGeneralSettingsDto,
    @Ip() ip: string,
  ): Promise<TenantGeneralSettings> {
    return this.settingsService.updateGeneralSettings(
      currentUser,
      request as UpdateTenantGeneralSettingsRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '获取角色列表' })
  @ApiOkResponse({ type: [TenantRoleAccountSwagger] })
  @Get('roles')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getRoles(@CurrentUser() currentUser: JwtPayload): Promise<TenantRoleAccount[]> {
    return this.settingsService.getRoles(currentUser);
  }

  @ApiOperation({ summary: '获取权限树' })
  @ApiOkResponse({ type: [PermissionNodeSwagger] })
  @Get('permissions')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getPermissions(): Promise<PermissionNode[]> {
    return this.settingsService.getPermissions();
  }

  @ApiOperation({ summary: '获取租户用户列表' })
  @ApiOkResponse({ type: [TenantSettingsUserSwagger] })
  @Get('users')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getUsers(@CurrentUser() currentUser: JwtPayload): Promise<TenantSettingsUser[]> {
    return this.settingsService.getUsers(currentUser);
  }

  @ApiOperation({ summary: '创建租户用户' })
  @ApiOkResponse({ type: TenantSettingsUserSwagger })
  @Post('users')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async createUser(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateTenantUserDto,
    @Ip() ip: string,
  ): Promise<TenantSettingsUser> {
    return this.settingsService.createUser(currentUser, request as CreateTenantUserRequest, ip);
  }

  @ApiOperation({ summary: '更新租户用户' })
  @ApiParam({ name: 'id', description: '用户 ID', format: 'uuid' })
  @ApiOkResponse({ type: TenantSettingsUserSwagger })
  @Put('users/:id')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async updateUser(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() request: UpdateTenantUserDto,
    @Ip() ip: string,
  ): Promise<TenantSettingsUser> {
    return this.settingsService.updateUser(
      currentUser,
      userId,
      request as UpdateTenantUserRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '删除租户用户' })
  @ApiParam({ name: 'id', description: '用户 ID', format: 'uuid' })
  @ApiOkResponse({ description: '删除成功', schema: { type: 'null' } })
  @Delete('users/:id')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async deleteUser(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Ip() ip: string,
  ): Promise<null> {
    return this.settingsService.deleteUser(currentUser, userId, ip);
  }

  @ApiOperation({ summary: '更新租户用户状态' })
  @ApiParam({ name: 'id', description: '用户 ID', format: 'uuid' })
  @ApiOkResponse({ type: TenantSettingsUserSwagger })
  @Patch('users/:id')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async patchUserStatus(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() request: PatchTenantUserStatusDto,
    @Ip() ip: string,
  ): Promise<TenantSettingsUser> {
    return this.settingsService.patchUserStatus(
      currentUser,
      userId,
      request as TenantUserStatusUpdateRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '获取打印配置列表' })
  @ApiOkResponse({ type: GetPrintingConfigListResponseSwagger })
  @Get('printing')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getPrintingConfigList(
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<GetPrintingConfigListResponse> {
    return this.settingsService.getPrintingConfigList(currentUser);
  }

  @ApiOperation({ summary: '获取单张映射模板打印配置' })
  @ApiParam({ name: 'importTemplateId', description: '导入映射模板 ID', format: 'uuid' })
  @ApiOkResponse({ type: GetPrintingConfigDetailResponseSwagger })
  @Get('printing/:importTemplateId')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getPrintingConfigDetail(
    @CurrentUser() currentUser: JwtPayload,
    @Param('importTemplateId', new ParseUUIDPipe()) importTemplateId: string,
  ): Promise<GetPrintingConfigDetailResponse> {
    return this.settingsService.getPrintingConfigDetail(currentUser, importTemplateId);
  }

  @ApiOperation({ summary: '保存单张映射模板打印配置' })
  @ApiParam({ name: 'importTemplateId', description: '导入映射模板 ID', format: 'uuid' })
  @ApiOkResponse({ type: UpdatePrintingConfigResponseSwagger })
  @Put('printing/:importTemplateId')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async updatePrintingConfig(
    @CurrentUser() currentUser: JwtPayload,
    @Param('importTemplateId', new ParseUUIDPipe()) importTemplateId: string,
    @Body() request: UpdatePrintingConfigDto,
    @Ip() ip: string,
  ): Promise<UpdatePrintingConfigResponse> {
    return this.settingsService.updatePrintingConfig(
      currentUser,
      importTemplateId,
      request as UpdatePrintingConfigRequest,
      ip,
    );
  }

  @ApiOperation({ summary: '获取租户操作日志' })
  @ApiOkResponse({ type: TenantAuditLogListResponseSwagger })
  @Get('audit-logs')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getAuditLogs(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<TenantAuditLogListResponse> {
    return this.settingsService.getAuditLogs(currentUser, query);
  }
}
