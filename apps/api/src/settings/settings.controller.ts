import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import type {
  GetPrintingConfigDetailResponse,
  GetPrintingConfigListResponse,
  TenantGeneralSettings,
  UpdateTenantGeneralSettingsRequest,
  UpdatePrintingConfigRequest,
  UpdatePrintingConfigResponse,
} from '@shou/types/contracts';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';
import { UpdatePrintingConfigDto } from './dto/update-printing-config.dto';
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
  ): Promise<TenantGeneralSettings> {
    return this.settingsService.updateGeneralSettings(
      currentUser,
      request as UpdateTenantGeneralSettingsRequest,
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
  ): Promise<UpdatePrintingConfigResponse> {
    return this.settingsService.updatePrintingConfig(
      currentUser,
      importTemplateId,
      request as UpdatePrintingConfigRequest,
    );
  }
}
