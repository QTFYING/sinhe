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

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('general')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getGeneralSettings(@CurrentUser() currentUser: JwtPayload): Promise<TenantGeneralSettings> {
    return this.settingsService.getGeneralSettings(currentUser);
  }

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

  @Get('roles')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getRoles(@CurrentUser() currentUser: JwtPayload): Promise<TenantRoleAccount[]> {
    return this.settingsService.getRoles(currentUser);
  }

  @Get('permissions')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getPermissions(): Promise<PermissionNode[]> {
    return this.settingsService.getPermissions();
  }

  @Get('users')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getUsers(@CurrentUser() currentUser: JwtPayload): Promise<TenantSettingsUser[]> {
    return this.settingsService.getUsers(currentUser);
  }

  @Post('users')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async createUser(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateTenantUserDto,
    @Ip() ip: string,
  ): Promise<TenantSettingsUser> {
    return this.settingsService.createUser(currentUser, request as CreateTenantUserRequest, ip);
  }

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

  @Delete('users/:id')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async deleteUser(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Ip() ip: string,
  ): Promise<null> {
    return this.settingsService.deleteUser(currentUser, userId, ip);
  }

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

  @Get('printing')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getPrintingConfigList(
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<GetPrintingConfigListResponse> {
    return this.settingsService.getPrintingConfigList(currentUser);
  }

  @Get('printing/:importTemplateId')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getPrintingConfigDetail(
    @CurrentUser() currentUser: JwtPayload,
    @Param('importTemplateId', new ParseUUIDPipe()) importTemplateId: string,
  ): Promise<GetPrintingConfigDetailResponse> {
    return this.settingsService.getPrintingConfigDetail(currentUser, importTemplateId);
  }

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

  @Get('audit-logs')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getAuditLogs(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListAuditLogsQueryDto,
  ): Promise<TenantAuditLogListResponse> {
    return this.settingsService.getAuditLogs(currentUser, query);
  }
}
