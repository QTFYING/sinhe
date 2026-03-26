import { BadRequestException, Injectable } from '@nestjs/common';
import { LifecycleEventEnum } from '@prisma/client';
import * as crypto from 'crypto';
import dayjs from 'dayjs';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ImportOrdersDto } from './dto/import-orders.dto';

@Injectable()
export class ImportService {
  constructor(private prisma: PrismaService) {}

  async importOrders(importOrdersDto: ImportOrdersDto, currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('OS Cannot import orders');

    const tenantId = currentUser.tenantId;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const creditExpireAt = dayjs().add(tenant.maxCreditDays, 'day').toDate();

    return this.prisma.$transaction(async (tx) => {
      let successCount = 0;
      let existingCount = 0;

      for (const orderInput of importOrdersDto.orders) {
        // 反复检查唯一记录 (逻辑隔离：防重复入库)
        const existing = await tx.order.findUnique({
          where: {
            tenantId_erpOrderNo: { tenantId, erpOrderNo: orderInput.erpOrderNo }
          }
        });

        if (existing) {
          existingCount++;
          continue;
        }

        const qrCodeToken = crypto.randomBytes(32).toString('hex');
        const qrExpireAt = dayjs().add(90, 'day').toDate();

        // 生单，确立不可变的 `totalAmount` 恒等式约束基础
        const newOrder = await tx.order.create({
          data: {
            tenantId,
            templateId: importOrdersDto.templateId,
            erpOrderNo: orderInput.erpOrderNo,
            customerName: orderInput.customerName,
            customerPhone: orderInput.customerPhone,
            deliveryAddress: orderInput.deliveryAddress,
            deliveryPersonName: orderInput.deliveryPersonName,
            customFields: orderInput.customFields || {},
            totalAmount: orderInput.totalAmount, // IMMUTABLE AFTER THIS
            paidAmount: '0.00',
            discountAmount: '0.00',
            qrCodeToken,
            qrExpireAt,
            creditExpireAt,
            items: {
              create: orderInput.items.map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.amount,
              }))
            }
          }
        });

        // 记录生命周期日志
        await tx.orderLifecycleLog.create({
          data: {
            orderId: newOrder.id,
            tenantId,
            event: LifecycleEventEnum.ORDER_CREATED,
            operatorId: currentUser.userId,
            snapshot: {
               totalAmount: newOrder.totalAmount.toString(),
               itemCount: orderInput.items.length
            }
          }
        });

        successCount++;
      }

      return { successCount, existingCount };
    });
  }
}
