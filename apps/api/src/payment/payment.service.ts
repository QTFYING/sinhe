import { Injectable, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { PayStatusEnum, LifecycleEventEnum, PaymentMethodEnum, PaymentRecordStatusEnum } from '@prisma/client';
import { BusinessException } from '../common/exceptions/business.exception';
import BigNumber from 'bignumber.js';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * C端扫码查询订单信息 — GET /pay/:token
   */
  async getOrderByToken(qrCodeToken: string) {
    const order = await this.prisma.order.findUnique({
      where: { qrCodeToken },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('订单不可用');

    if (order.qrExpireAt && new Date() > order.qrExpireAt) {
      throw new BusinessException(1002, '二维码已过期，请联系经销商重新获取', HttpStatus.GONE);
    }

    const totalAmount = new BigNumber(order.totalAmount.toString());
    const discountAmount = new BigNumber(order.discountAmount.toString());
    const paidAmount = new BigNumber(order.paidAmount.toString());
    const payableAmount = totalAmount.minus(paidAmount).minus(discountAmount);

    if (order.payStatus === PayStatusEnum.PAID) {
      return {
        orderId: order.id,
        payStatus: order.payStatus,
        paidAmount: order.paidAmount.toString(),
      };
    }

    return {
      orderId: order.id,
      payStatus: order.payStatus,
      customerName: order.customerName,
      totalAmount: order.totalAmount.toString(),
      discountAmount: order.discountAmount.toString(),
      payableAmount: payableAmount.toString(),
      items: order.items.map(i => ({
        productName: i.productName,
        quantity: i.quantity,
        amount: i.amount.toString(),
      })),
    };
  }

  /**
   * C端主动查询支付状态 — GET /pay/:token/status
   */
  async getPaymentStatus(qrCodeToken: string) {
    const order = await this.prisma.order.findUnique({ where: { qrCodeToken } });
    if (!order) throw new NotFoundException('订单不可用');

    if (order.payStatus === PayStatusEnum.PAID) {
      const lastPayment = await this.prisma.paymentRecord.findFirst({
        where: { orderId: order.id, status: PaymentRecordStatusEnum.SUCCESS },
        orderBy: { paidTime: 'desc' },
      });
      return {
        payStatus: order.payStatus,
        paidAmount: order.paidAmount.toString(),
        paidTime: lastPayment?.paidTime,
      };
    }

    return { payStatus: order.payStatus };
  }

  /**
   * C端扫码发起支付 - 由后端锁定金额，禁止前端传金额
   */
  async initiatePayment(qrCodeToken: string) {
    const order = await this.prisma.order.findUnique({ where: { qrCodeToken } });
    if (!order) throw new NotFoundException('订单不可用 / Invalid code');

    // Check QR code expiry
    if (order.qrExpireAt && new Date() > order.qrExpireAt) {
      throw new BusinessException(1002, '二维码已过期，请联系经销商重新获取', HttpStatus.GONE);
    }

    // Redis 分布式锁防并发 — TTL 设为支付超时时间，不在 finally 中释放
    const lockKey = `pay:lock:${order.id}`;
    const lockValue = await this.redis.acquireLock(lockKey, 300); // 5 minutes TTL, expires naturally
    if (!lockValue) throw new BusinessException(1003, '支付进行中，请稍候...', HttpStatus.CONFLICT);

    if (order.payStatus === PayStatusEnum.PAID) {
      await this.redis.releaseLock(lockKey, lockValue);
      throw new BusinessException(1001, '订单已支付，请勿重复操作', HttpStatus.CONFLICT);
    }

    // 金额服务端定格
    const totalAmount = new BigNumber(order.totalAmount.toString());
    const paidAmount = new BigNumber(order.paidAmount.toString());
    const discountAmount = new BigNumber(order.discountAmount.toString());

    const payableAmount = totalAmount.minus(paidAmount).minus(discountAmount);
    if (payableAmount.lte(0)) {
      await this.redis.releaseLock(lockKey, lockValue);
      throw new BadRequestException('无需支付 / No remaining balance');
    }

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

    // Lock is NOT released here — it will be released after webhook or expire via TTL
    return {
      orderId: order.id,
      payableAmount: payableAmount.toString(),
      cashierUrl: `https://cashier.lakala.com/pay?token=${order.qrCodeToken}`,
    };
  }

  /**
   * Webhook 幂等入账
   */
  async handleWebhook(payload: any) {
    const tradeNo = payload.channelTradeNo || payload.txNo;
    const orderId = payload.merchantOrderNo || payload.orderId;
    const amountStr = payload.totalAmount || payload.amount;

    return this.prisma.$transaction(async (tx) => {
      try {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order) return { code: 'SUCCESS', message: 'OK' };

        await tx.paymentRecord.create({
          data: {
            orderId: order.id,
            tenantId: order.tenantId,
            actualAmount: amountStr,
            paymentMethod: PaymentMethodEnum.ONLINE_PAYMENT,
            channelTradeNo: tradeNo,
            rawCallbackData: payload,
            status: PaymentRecordStatusEnum.SUCCESS,
            paidTime: payload.payTime ? new Date(payload.payTime) : new Date()
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

        // Release payment lock after successful webhook processing
        const lockKey = `pay:lock:${order.id}`;
        await this.redis.releaseLock(lockKey, '').catch(() => {
          // Lock may have expired naturally — that's fine
        });

        return { code: 'SUCCESS', message: 'OK' };
      } catch (e: any) {
        // P2002 是 Prisma 的 Unique Constraint 冲突代码 — 静默跳过重复入账
        if (e.code === 'P2002') return { code: 'SUCCESS', message: 'OK' };
        throw e;
      }
    });
  }

  /**
   * B端员工手工标记已支付
   */
  async manualMarkup(orderId: string, actualAmount: string, markReason: string, paidTime: string | undefined, currentUser: JwtPayload) {
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

      const markAmount = new BigNumber(actualAmount);
      if (markAmount.lte(0) || markAmount.gt(payableAmount)) {
        throw new BusinessException(
          1004,
          `实收金额必须在 0.01 ~ ${payableAmount.toFixed(2)} 之间`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      const resolvedPaidTime = paidTime ? new Date(paidTime) : new Date();

      await tx.paymentRecord.create({
        data: {
          orderId: order.id,
          tenantId: order.tenantId,
          actualAmount: markAmount.toString(),
          paymentMethod: PaymentMethodEnum.MANUAL_MARKUP,
          operatorId: currentUser.userId,
          markReason,
          status: PaymentRecordStatusEnum.SUCCESS,
          paidTime: resolvedPaidTime,
        }
      });

      const newPaidAmount = paidAmount.plus(markAmount);
      const isFullyPaid = newPaidAmount.plus(discountAmount).gte(totalAmount);

      await tx.order.update({
        where: { id: order.id },
        data: {
          paidAmount: newPaidAmount.toString(),
          payStatus: isFullyPaid ? PayStatusEnum.PAID : PayStatusEnum.PARTIAL_PAID,
        }
      });

      await tx.orderLifecycleLog.create({
        data: {
          orderId: order.id,
          tenantId: order.tenantId,
          event: LifecycleEventEnum.PAYMENT_MANUAL_MARKUP,
          operatorId: currentUser.userId,
          remark: markReason,
          snapshot: {
            actualAmount: markAmount.toString(),
            newPaidAmount: newPaidAmount.toString(),
          }
        }
      });

      return {
        id: order.id,
        paidAmount: newPaidAmount.toString(),
        discountAmount: discountAmount.toString(),
        payStatus: isFullyPaid ? PayStatusEnum.PAID : PayStatusEnum.PARTIAL_PAID,
      };
    });
  }
}
