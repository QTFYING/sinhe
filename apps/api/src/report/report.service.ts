import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  async getDailyFinancialSummary(currentUser: JwtPayload, startDate: string, endDate: string) {
    if (!currentUser.tenantId) throw new BadRequestException('Not in tenant scope');

    const result = await this.prisma.order.aggregate({
      _sum: {
        totalAmount: true,
        paidAmount: true,
        discountAmount: true,
      },
      where: {
        tenantId: currentUser.tenantId,
        createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
        deletedAt: null
      }
    });

    return {
      totalAmount: result._sum.totalAmount || 0,
      paidAmount: result._sum.paidAmount || 0,
      discountAmount: result._sum.discountAmount || 0,
    };
  }
}
