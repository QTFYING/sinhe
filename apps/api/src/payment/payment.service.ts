import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { PayStatusEnum, LifecycleEventEnum, PaymentMethodEnum, PaymentRecordStatusEnum } from '@prisma/client';
import BigNumber from 'bignumber.js';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * C端扫码发起支付 - 由后端锁定金额，禁止前端传金额
   */
  async initiatePayment(qrCodeToken: string) {
    const order = await this.prisma.order.findUnique({ where: { qrCodeToken } });
    if (!order) throw new NotFoundException('订单不可用 / Invalid code');
    
    // Redis 分布式锁防并发
    const lockKey = `pay:lock:${order.id}`;
    const acquired = await this.redis.acquireLock(lockKey, 10);
    if (!acquired) throw new ConflictException('支付正在处理中，请勿频繁点击');

    try {
      if (order.payStatus === PayStatusEnum.PAID) {
        throw new BadRequestException('该订单已支付 / Already paid');
      }

      // 金额服务端定格
      const totalAmount = new BigNumber(order.totalAmount.toString());
      const paidAmount = new BigNumber(order.paidAmount.toString());
      const discountAmount = new BigNumber(order.discountAmount.toString());
      
      const payableAmount = totalAmount.minus(paidAmount).minus(discountAmount);
      if (payableAmount.lte(0)) throw new BadRequestException('无需支付 / No remaining balance');

      await this.prisma.order.update({
        where: { id: order.id },
        data: { payStatus: PayStatusEnum.PAYING }
      });

      await this.prisma.orderLifecycleLog.create({
        data: {
          orderId: order.id,
          tenantId: order.tenantId,
          event: LifecycleEventEnum.PAYMENT_INITIATED,
          snapshot: { payableAmount: payableAmount.toString() }
        }
      });

      return {
        orderId: order.id,
        amount: payableAmount.toString(),
        payParams: { gateway: 'lakala_simulator_url' }
      };
    } finally {
      await this.redis.releaseLock(lockKey);
    }
  }

  /**
   * Webhook 幂等入账
   */
  async handleWebhook(payload: any) {
    const tradeNo = payload.txNo; 
    const orderId = payload.orderId;
    const amountStr = payload.amount;

    return this.prisma.$transaction(async (tx) => {
      try {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order) return { msg: 'Order not found' };

        await tx.paymentRecord.create({
          data: {
            orderId: order.id,
            tenantId: order.tenantId,
            actualAmount: amountStr,
            paymentMethod: PaymentMethodEnum.ONLINE_PAYMENT,
            channelTradeNo: tradeNo,
            rawCallbackData: payload,
            status: PaymentRecordStatusEnum.SUCCESS,
            paidTime: new Date()
          }
        });

        const newPaidAmount = new BigNumber(order.paidAmount.toString()).plus(new BigNumber(amountStr));
        const total = new BigNumber(order.totalAmount.toString());
        const discount = new BigNumber(order.discountAmount.toString());
        
        const isFullyPaid = newPaidAmount.plus(discount).gte(total);

        await tx.order.update({
          where: { id: order.id },
          data: {
            paidAmount: newPaidAmount.toString(),
            payStatus: isFullyPaid ? PayStatusEnum.PAID : PayStatusEnum.PARTIAL_PAID
          }
        });

        await tx.orderLifecycleLog.create({
           data: {
             orderId: order.id,
             tenantId: order.tenantId,
             event: LifecycleEventEnum.PAYMENT_SUCCESS_WEBHOOK,
             snapshot: { tradeNo, amountStr }
           }
        });

        return { msg: 'success' };
      } catch (e: any) {
        // P2002 是 Prisma 的 Unique Constraint 冲突代码
        if (e.code === 'P2002') return { msg: 'ignored - duplicate' };
        throw e;
      }
    });
  }

  /**
   * B端员工手工标记已支付
   */
  async manualMarkup(orderId: string, remark: string, currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('OS Cannot markup orders');
    
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId: currentUser.tenantId, deletedAt: null }
      });
      if (!order) throw new NotFoundException('订单不存在');
      if (order.payStatus === PayStatusEnum.PAID) throw new BadRequestException('已经完全支付');

      const totalAmount = new BigNumber(order.totalAmount.toString());
      const paidAmount = new BigNumber(order.paidAmount.toString());
      const discountAmount = new BigNumber(order.discountAmount.toString());
      
      const payableAmount = totalAmount.minus(paidAmount).minus(discountAmount);

      await tx.paymentRecord.create({
        data: {
          orderId: order.id,
          tenantId: order.tenantId,
          actualAmount: payableAmount.toString(),
          paymentMethod: PaymentMethodEnum.MANUAL_MARKUP,
          operatorId: currentUser.userId,
          markReason: remark,
          status: PaymentRecordStatusEnum.SUCCESS,
          paidTime: new Date()
        }
      });

      const newPaidAmount = paidAmount.plus(payableAmount);
      await tx.order.update({
        where: { id: order.id },
        data: {
          paidAmount: newPaidAmount.toString(),
          payStatus: PayStatusEnum.PAID
        }
      });

      await tx.orderLifecycleLog.create({
        data: {
          orderId: order.id,
          tenantId: order.tenantId,
          event: LifecycleEventEnum.PAYMENT_MANUAL_MARKUP,
          operatorId: currentUser.userId,
          remark,
          snapshot: { newPaidAmount: newPaidAmount.toString() }
        }
      });

      return { success: true };
    });
  }
}
