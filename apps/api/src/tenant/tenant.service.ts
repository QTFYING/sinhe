import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async createTenant(createTenantDto: CreateTenantDto, currentUser: JwtPayload) {
    // 【安全红线】只有 OS 级别人能够生层新租户
    if (currentUser.role !== UserRoleEnum.OS_SUPER_ADMIN && currentUser.role !== UserRoleEnum.OS_OPERATOR) {
      throw new ForbiddenException('Only OS admins can create tenants');
    }

    return this.prisma.tenant.create({
      data: {
        name: createTenantDto.name,
        contactPhone: createTenantDto.contactPhone,
        maxCreditDays: createTenantDto.maxCreditDays,
      },
    });
  }

  async getTenantInfo(currentUser: JwtPayload) {
    if (!currentUser.tenantId) {
      throw new ForbiddenException('OS Users do not belong to a specific tenant scope');
    }
    
    // 【安全红线】绝不允许信任传参，只读 JWT 里的 tenantId
    return this.prisma.tenant.findUnique({
      where: { id: currentUser.tenantId },
    });
  }
}
