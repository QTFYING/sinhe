import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type {
  TenantGeneralSettings,
  UpdateTenantGeneralSettingsRequest,
} from '@shou/types/contracts';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateGeneralSettingsDto } from './dto/update-general-settings.dto';
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
}
