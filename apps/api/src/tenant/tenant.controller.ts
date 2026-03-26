import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createTenant(
    @Body() createTenantDto: CreateTenantDto,
  ) {
    return this.tenantService.createTenant(createTenantDto);
  }

  @Get('me')
  @Roles(
    UserRoleEnum.TENANT_OWNER, 
    UserRoleEnum.TENANT_OPERATOR, 
    UserRoleEnum.TENANT_FINANCE, 
    UserRoleEnum.TENANT_VIEWER
  )
  async getTenantInfo(@CurrentUser() currentUser: JwtPayload) {
    return this.tenantService.getTenantInfo(currentUser);
  }
}
