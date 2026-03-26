import { Injectable, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { AdjustPriceDto } from './dto/adjust-price.dto';
import { LifecycleEventEnum } from '@prisma/client';
import { BusinessException } from '../common/exceptions/business.exception';
import BigNumber from 'bignumber.js';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  async findAll(currentUser: JwtPayload, page = 1, pageSize = 20, filters?: {
    payStatus?: string;
    deliveryStatus?: string;
    keyword?: string;
    templateId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    if (!currentUser.tenantId) throw new BadRequestException('OS Cannot directly query orders without tenant scope');

    const where: any = { tenantId: currentUser.tenantId, deletedAt: null };

    if (filters?.payStatus) where.payStatus = filters.payStatus;
    if (filters?.deliveryStatus) where.deliveryStatus = filters.deliveryStatus;
    if (filters?.templateId) where.templateId = filters.templateId;
    if (filters?.keyword) {
      where.OR = [
        { erpOrderNo: { contains: filters.keyword, mode: 'insensitive' } },
        { customerName: { contains: filters.keyword, mode: 'insensitive' } },
        { deliveryPersonName: { contains: filters.keyword, mode: 'insensitive' } },
      ];
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate + 'T23:59:59.999Z');
    }

    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    const result: any = { list, total, page, pageSize };

    // When filtering by templateId, return template customFieldDefs
    if (filters?.templateId) {
      const template = await this.prisma.importTemplate.findUnique({
        where: { id: filters.templateId },
      });
      if (template && template.customFieldDefs) {
        result.templateCustomFields = (template.customFieldDefs as any[]).map((d: any) => ({
          fieldKey: d.fieldKey,
          label: d.label,
          showInList: d.showInList,
        }));
      }
    }

    return result;
  }

  async getOrder(orderId: string, currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('OS Cannot directly query orders without tenant scope');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: currentUser.tenantId, deletedAt: null },
      include: {
        items: true,
        paymentRecords: true,
        lifecycleLogs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) throw new NotFoundException('订单不存在');

    return {
      ...order,
      payments: order.paymentRecords,
      logs: order.lifecycleLogs,
    };
  }

  async adjustPrice(orderId: string, adjustPriceDto: AdjustPriceDto, currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('OS Cannot adjust order price');

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId: currentUser.tenantId, deletedAt: null }
      });

      if (!order) throw new NotFoundException('订单不存在或无权操作');

      // Validate: discountAmount must not exceed totalAmount - paidAmount
      const totalAmount = new BigNumber(order.totalAmount.toString());
      const paidAmount = new BigNumber(order.paidAmount.toString());
      const newDiscount = new BigNumber(adjustPriceDto.discountAmount);
      const maxAllowedDiscount = totalAmount.minus(paidAmount);

      if (newDiscount.gt(maxAllowedDiscount)) {
        throw new BusinessException(
          1004,
          `减免金额不得超过 ${maxAllowedDiscount.toFixed(2)}（totalAmount - paidAmount）`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      if (newDiscount.lt(0)) {
        throw new BusinessException(1004, '减免金额不能为负数', HttpStatus.UNPROCESSABLE_ENTITY);
      }

      const oldDiscount = order.discountAmount.toString();

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: { discountAmount: adjustPriceDto.discountAmount },
      });

      await tx.orderLifecycleLog.create({
        data: {
          orderId: order.id,
          tenantId: currentUser.tenantId,
          event: LifecycleEventEnum.PRICE_ADJUSTED,
          operatorId: currentUser.userId,
          remark: adjustPriceDto.reason,
          snapshot: {
            before: { discountAmount: oldDiscount },
            after: { discountAmount: adjustPriceDto.discountAmount },
          },
        },
      });

      return {
        id: updatedOrder.id,
        totalAmount: updatedOrder.totalAmount.toString(),
        paidAmount: updatedOrder.paidAmount.toString(),
        discountAmount: updatedOrder.discountAmount.toString(),
        payStatus: updatedOrder.payStatus,
      };
    });
  }
}
