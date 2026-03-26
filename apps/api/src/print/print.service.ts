import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { LifecycleEventEnum } from '@prisma/client';

@Injectable()
export class PrintService {
  constructor(private prisma: PrismaService) {}

  async createPrintJob(dto: CreatePrintJobDto, currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new NotFoundException('OS Cannot print');

    // Mapped precisely to the schema, enforcing tenant scope
    const orders = await this.prisma.order.findMany({
      where: {
        id: { in: dto.orderIds },
        tenantId: currentUser.tenantId,
        deletedAt: null
      },
      include: { items: true }
    });

    if (orders.length === 0) return { printData: [] };

    // Strict logging of printed documents
    await this.prisma.$transaction(
      orders.map(order => 
        this.prisma.orderLifecycleLog.create({
          data: {
            orderId: order.id,
            tenantId: currentUser.tenantId as string,
            event: LifecycleEventEnum.ORDER_PRINTED,
            operatorId: currentUser.userId,
          }
        })
      )
    );

    // Format ready for frontend hidden iframe rendering
    return {
      printData: orders.map(o => ({
        orderId: o.id,
        erpOrderNo: o.erpOrderNo,
        customerName: o.customerName,
        deliveryAddress: o.deliveryAddress,
        deliveryPersonName: o.deliveryPersonName,
        totalAmount: o.totalAmount,
        discountAmount: o.discountAmount,
        paidAmount: o.paidAmount,
        items: o.items.map(i => ({
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount
        }))
      }))
    };
  }
}
