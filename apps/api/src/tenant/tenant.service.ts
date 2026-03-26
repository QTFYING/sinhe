import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async createTenant(createTenantDto: CreateTenantDto) {
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

    return this.prisma.tenant.findUnique({
      where: { id: currentUser.tenantId },
    });
  }
}
