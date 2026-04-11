import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';
import { TenantBaseRecordSwagger } from './tenant.swagger';

@ApiTags('Tenant Base')
@ApiBearerAuth()
@ApiExtraModels(TenantBaseRecordSwagger)
@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @ApiOperation({ summary: '创建基础租户记录' })
  @ApiOkResponse({ type: TenantBaseRecordSwagger })
  @Post()
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createTenant(
    @Body() createTenantDto: CreateTenantDto,
  ) {
    return this.tenantService.createTenant(createTenantDto);
  }

  @ApiOperation({ summary: '获取当前租户信息' })
  @ApiOkResponse({ type: TenantBaseRecordSwagger })
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
