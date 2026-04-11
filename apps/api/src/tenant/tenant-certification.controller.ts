import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import type {
  TenantCertificationStatusResult,
  TenantCertificationSubmitRequest,
  TenantCertificationSubmitResponse,
} from '@shou/types/contracts';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTenantCertificationDto } from './dto/create-tenant-certification.dto';
import { TenantService } from './tenant.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantCertificationController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('certification')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async submitCertification(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateTenantCertificationDto,
    @Ip() ip: string,
  ): Promise<TenantCertificationSubmitResponse> {
    return this.tenantService.submitCertification(
      currentUser,
      request as TenantCertificationSubmitRequest,
      ip,
    );
  }

  @Get('certification')
  @Roles(UserRoleEnum.TENANT_OWNER)
  async getCertificationStatus(
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<TenantCertificationStatusResult> {
    return this.tenantService.getCertificationStatus(currentUser);
  }
}
