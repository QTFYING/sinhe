import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { AdjustPriceDto } from './dto/adjust-price.dto';
import { LifecycleEventEnum } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  async getOrder(orderId: string, currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('OS Cannot directly query orders without tenant scope');
    
    // 【安全红线】必须带入 tenantId: currentUser.tenantId 检索
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId: currentUser.tenantId, deletedAt: null }
    });
    
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  async adjustPrice(orderId: string, adjustPriceDto: AdjustPriceDto, currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('OS Cannot adjust order price');
    
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch order with tenant metadata check
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId: currentUser.tenantId, deletedAt: null }
      });

      if (!order) throw new NotFoundException('订单不存在或无权操作');

      // 2. totalAmount 永远不可更改。只能改 discountAmount
      const oldDiscount = order.discountAmount.toString();
      const newDiscount = adjustPriceDto.newDiscountAmount;

      // 3. 更新金额
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          discountAmount: newDiscount
        }
      });

      // 4. 【安全红线】记录操作流水审计表，带入修改前后的快照
      await tx.orderLifecycleLog.create({
        data: {
          orderId: order.id,
          tenantId: currentUser.tenantId,
          event: LifecycleEventEnum.PRICE_ADJUSTED,
          operatorId: currentUser.userId,
          remark: adjustPriceDto.remark,
          snapshot: {
            before: { discountAmount: oldDiscount },
            after: { discountAmount: newDiscount }
          }
        }
      });

      return updatedOrder;
    });
  }
}
