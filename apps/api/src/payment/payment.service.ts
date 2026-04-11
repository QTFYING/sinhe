import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashVerifyStatusEnum as PrismaCashVerifyStatusEnum,
  OrderPayTypeEnum as PrismaOrderPayTypeEnum,
  OrderStatusEnum as PrismaOrderStatusEnum,
  PaymentChannelEnum as PrismaPaymentChannelEnum,
  PaymentMethodEnum as PrismaPaymentMethodEnum,
  PaymentOrderStatusEnum as PrismaPaymentOrderStatusEnum,
  PaymentRecordStatusEnum as PrismaPaymentRecordStatusEnum,
  Prisma,
} from '@prisma/client';
import type {
  AdminPaymentRecordItem,
  CreateCashVerificationResponse,
  InitiatePaymentResponse,
  OfflinePaymentInfo,
  PaymentListQuery,
  PaymentOrderDetailResponse,
  PaymentStatusResponse,
  PaymentSummaryResponse,
  SubmitOfflinePaymentRequest,
  SubmitOfflinePaymentResponse,
  TenantPaymentRecordItem,
} from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import {
  CashVerifyStatusEnum,
  OfflinePaymentMethodEnum,
  OrderPayTypeEnum,
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentOrderStatusEnum,
  PaymentRecordStatusEnum,
  type OfflinePaymentMethod,
  type OrderPayType,
  type OrderStatus,
  type PaymentMethod,
  type PaymentOrderStatus,
  type PaymentRecordStatus,
} from '@shou/types/enums';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import { randomBytes } from 'crypto';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { BusinessException } from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  PAYMENT_PAYING_EXPIRE_MINUTES,
  resolvePaymentOrderStatus,
  shouldExpirePayingPaymentOrder,
} from './payment.domain';

const PAYMENT_REQUEST_LOCK_SECONDS = 10;

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getPaymentDetail(token: string): Promise<PaymentOrderDetailResponse> {
    const order = await this.getPublicOrderByToken(token);
    if (order.voided) {
      throw new BusinessException(1002, '二维码路由已过期', 410);
    }

    const latestPaymentOrder = await this.getLatestPaymentOrder(order.id);
    const currentPaymentOrder = await this.expireIfNeeded(latestPaymentOrder);
    const status = resolvePaymentOrderStatus(order, currentPaymentOrder);

    return {
      orderNo: order.id,
      merchant: order.tenant.generalSettings?.companyName || order.tenant.name,
      customer: order.customer,
      amount: this.toMoneyNumber(order.amount),
      paidAmount: this.toMoneyNumber(order.paid),
      summary: order.summary,
      date: order.date.toISOString(),
      status,
      statusMessage: currentPaymentOrder?.statusMessage ?? undefined,
      servicePhone: order.tenant.generalSettings?.contactPhone || order.tenant.contactPhone,
      selectedPaymentMethod: currentPaymentOrder
        ? this.fromPrismaPaymentMethod(currentPaymentOrder.paymentMethod)
        : null,
      offlinePayment: this.toOfflinePaymentInfo(currentPaymentOrder),
      items: order.lineItems.map((item) => ({
        itemId: item.id,
        skuId: item.skuId,
        skuName: item.skuName,
        skuSpec: item.skuSpec ?? undefined,
        unit: item.unit,
        quantity: this.toDecimalNumber(item.quantity, 3),
        unitPrice: this.toMoneyNumber(item.unitPrice),
        lineAmount: this.toMoneyNumber(item.lineAmount),
      })),
    };
  }

  async initiatePayment(token: string): Promise<InitiatePaymentResponse> {
    const order = await this.getPublicOrderByToken(token);
    if (order.voided) {
      throw new BusinessException(1002, '二维码路由已过期', 410);
    }

    const lockKey = `payment:initiate:${order.id}`;
    const lockValue = await this.redis.acquireLock(lockKey, PAYMENT_REQUEST_LOCK_SECONDS);
    if (!lockValue) {
      throw new BusinessException(1003, '支付进行中，请勿重复发起', 409);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
        if (!currentOrder || currentOrder.deletedAt) {
          throw new BusinessException(40401, '订单不存在', 404);
        }

        const latest = await this.getLatestPaymentOrder(order.id, tx);
        const currentPaymentOrder = await this.expireIfNeeded(latest, tx);
        const paymentStatus = resolvePaymentOrderStatus(currentOrder, currentPaymentOrder);
        const payableAmount = this.getRemainingAmount(currentOrder);

        if (payableAmount.lte(0) || currentOrder.status === PrismaOrderStatusEnum.PAID) {
          throw new BusinessException(1001, '订单已支付完毕，不允许重复发起', 409);
        }
        if (paymentStatus === PaymentOrderStatusEnum.PAYING) {
          throw new BusinessException(1003, '支付进行中，请稍候确认', 409);
        }
        if (paymentStatus === PaymentOrderStatusEnum.PENDING_VERIFICATION) {
          throw new BusinessException(40402, '订单已登记现金支付，等待财务核销', 400);
        }

        const gatewayTradeNo = this.generateGatewayTradeNo();
        await tx.paymentOrder.create({
          data: {
            tenantId: currentOrder.tenantId,
            orderId: currentOrder.id,
            amount: this.toPrismaDecimal(payableAmount),
            status: PrismaPaymentOrderStatusEnum.PAYING,
            paymentMethod: PrismaPaymentMethodEnum.ONLINE,
            channel: PrismaPaymentChannelEnum.LAKALA,
            statusMessage: '支付确认中',
            gatewayTradeNo,
            lastInitiatedAt: new Date(),
          },
        });

        return {
          cashierUrl: this.buildCashierUrl(gatewayTradeNo),
          orderId: currentOrder.id,
          payableAmount: payableAmount.toFixed(2),
        };
      });
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(50001, '支付网关统一下单调度失败', 500);
    } finally {
      await this.redis.releaseLock(lockKey, lockValue).catch(() => false);
    }
  }

  async submitOfflinePayment(
    token: string,
    request: SubmitOfflinePaymentRequest,
  ): Promise<SubmitOfflinePaymentResponse> {
    const paymentMethod = this.parseOfflinePaymentMethod(request.paymentMethod);
    if (paymentMethod === OfflinePaymentMethodEnum.CASH && !request.remark?.trim()) {
      throw new BusinessException(40002, '现金支付时 remark 必填', 400);
    }

    const order = await this.getPublicOrderByToken(token);
    if (order.voided) {
      throw new BusinessException(1002, '二维码路由已过期', 410);
    }

    const lockKey = `payment:offline:${order.id}`;
    const lockValue = await this.redis.acquireLock(lockKey, PAYMENT_REQUEST_LOCK_SECONDS);
    if (!lockValue) {
      throw new ConflictException('支付处理进行中，请稍后重试');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const currentOrder = await tx.order.findUnique({ where: { id: order.id } });
        if (!currentOrder || currentOrder.deletedAt) {
          throw new BusinessException(40401, '订单不存在', 404);
        }

        const latest = await this.getLatestPaymentOrder(currentOrder.id, tx);
        const currentPaymentOrder = await this.expireIfNeeded(latest, tx);
        const paymentStatus = resolvePaymentOrderStatus(currentOrder, currentPaymentOrder);
        if (paymentStatus !== PaymentOrderStatusEnum.UNPAID) {
          throw new BusinessException(40402, '订单状态不是 unpaid，不允许登记线下支付', 400);
        }

        const payableAmount = this.getRemainingAmount(currentOrder);
        if (payableAmount.lte(0)) {
          throw new BusinessException(1001, '订单已支付完毕，不允许重复操作', 409);
        }

        const now = new Date();
        const created = await tx.paymentOrder.create({
          data: {
            tenantId: currentOrder.tenantId,
            orderId: currentOrder.id,
            amount: this.toPrismaDecimal(payableAmount),
            status:
              paymentMethod === OfflinePaymentMethodEnum.CASH
                ? PrismaPaymentOrderStatusEnum.PENDING_VERIFICATION
                : PrismaPaymentOrderStatusEnum.PAID,
            paymentMethod:
              paymentMethod === OfflinePaymentMethodEnum.CASH
                ? PrismaPaymentMethodEnum.CASH
                : PrismaPaymentMethodEnum.OTHER_PAID,
            statusMessage:
              paymentMethod === OfflinePaymentMethodEnum.CASH ? '订单待核销' : '已登记其他方式已付',
            offlineRemark: request.remark?.trim() || null,
            cashVerifyStatus:
              paymentMethod === OfflinePaymentMethodEnum.CASH
                ? PrismaCashVerifyStatusEnum.PENDING
                : null,
            offlineSubmittedAt: now,
            paidAt: paymentMethod === OfflinePaymentMethodEnum.OTHER_PAID ? now : null,
          },
        });

        if (paymentMethod === OfflinePaymentMethodEnum.OTHER_PAID) {
          await this.createPaymentRecordAndApplyOrder(tx, currentOrder, {
            amount: payableAmount,
            channel: 'other_paid',
            status: PrismaPaymentRecordStatusEnum.SUCCESS,
            paidAt: now,
          });
        }

        return {
          orderNo: currentOrder.id,
          status: this.fromPrismaPaymentOrderStatus(created.status),
          statusMessage: created.statusMessage ?? undefined,
          selectedPaymentMethod: this.fromPrismaPaymentMethod(created.paymentMethod),
          offlinePayment: this.toOfflinePaymentInfo(created),
        };
      });
    } finally {
      await this.redis.releaseLock(lockKey, lockValue).catch(() => false);
    }
  }

  async getPaymentStatus(token: string): Promise<PaymentStatusResponse> {
    const order = await this.getPublicOrderByToken(token);
    if (order.voided) {
      throw new BusinessException(1002, '二维码路由已过期', 410);
    }

    const latestPaymentOrder = await this.getLatestPaymentOrder(order.id);
    const currentPaymentOrder = await this.expireIfNeeded(latestPaymentOrder);
    const status = resolvePaymentOrderStatus(order, currentPaymentOrder);
    const latestPayment =
      status === PaymentOrderStatusEnum.PAID
        ? await this.prisma.payment.findFirst({
            where: { orderId: order.id },
            orderBy: { paidAt: 'desc' },
          })
        : null;

    return {
      orderNo: order.id,
      status,
      statusMessage: currentPaymentOrder?.statusMessage ?? undefined,
      paidAmount: status === PaymentOrderStatusEnum.PAID ? this.toMoneyNumber(order.paid) : undefined,
      paidAt: latestPayment?.paidAt.toISOString() ?? currentPaymentOrder?.paidAt?.toISOString(),
      selectedPaymentMethod: currentPaymentOrder
        ? this.fromPrismaPaymentMethod(currentPaymentOrder.paymentMethod) ?? undefined
        : undefined,
    };
  }

  async getPayments(
    currentUser: JwtPayload,
    query: PaymentListQuery,
  ): Promise<PaginatedResponse<TenantPaymentRecordItem | AdminPaymentRecordItem>> {
    if (!currentUser.tenantId) {
      return this.getAdminPayments(query);
    }

    const tenantId = this.getTenantId(currentUser);
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const where: Prisma.PaymentWhereInput = {
      tenantId,
    };

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      const orConditions: Prisma.PaymentWhereInput[] = [
        { customer: { contains: keyword, mode: 'insensitive' } },
      ];
      if (this.isUuid(keyword)) {
        orConditions.push({ orderId: keyword });
      }
      where.OR = orConditions;
    }
    if (query.channel?.trim()) {
      where.channel = query.channel.trim();
    }

    const [records, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      list: records.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        customer: item.customer,
        amount: this.toMoneyNumber(item.amount),
        channel: item.channel,
        fee: this.toMoneyNumber(item.fee),
        net: this.toMoneyNumber(item.net),
        status: this.fromPrismaPaymentRecordStatus(item.status),
        paidAt: item.paidAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getPaymentSummary(currentUser: JwtPayload): Promise<PaymentSummaryResponse> {
    if (!currentUser.tenantId) {
      return this.getAdminPaymentSummary();
    }

    const tenantId = this.getTenantId(currentUser);
    const start = dayjs().startOf('day').toDate();
    const end = dayjs().endOf('day').toDate();
    const where: Prisma.PaymentWhereInput = {
      tenantId,
      paidAt: {
        gte: start,
        lte: end,
      },
    };

    const [aggregate, totalCount, abnormalCount] = await Promise.all([
      this.prisma.payment.aggregate({
        where,
        _sum: {
          amount: true,
          fee: true,
          net: true,
        },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({
        where: {
          ...where,
          status: { not: PrismaPaymentRecordStatusEnum.SUCCESS },
        },
      }),
    ]);

    return {
      totalAmount: this.toMoneyNumber(aggregate._sum.amount ?? 0),
      totalFee: this.toMoneyNumber(aggregate._sum.fee ?? 0),
      totalNet: this.toMoneyNumber(aggregate._sum.net ?? 0),
      totalCount,
      abnormalCount,
    };
  }

  async createCashVerification(
    currentUser: JwtPayload,
    orderId: string,
  ): Promise<CreateCashVerificationResponse> {
    const tenantId = this.getTenantId(currentUser);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId, deletedAt: null },
      });
      if (!order) {
        throw new NotFoundException('订单不存在');
      }

      const paymentOrder = await tx.paymentOrder.findFirst({
        where: {
          orderId,
          tenantId,
          status: PrismaPaymentOrderStatusEnum.PENDING_VERIFICATION,
          paymentMethod: PrismaPaymentMethodEnum.CASH,
        },
        orderBy: [{ offlineSubmittedAt: 'desc' }, { createdAt: 'desc' }],
      });
      if (!paymentOrder) {
        throw new ConflictException('当前订单没有待核销的现金支付记录');
      }

      const remaining = this.getRemainingAmount(order);
      const payable = this.decimal(paymentOrder.amount);
      if (remaining.lt(payable) || remaining.lte(0)) {
        throw new ConflictException('订单当前可核销金额异常，无法完成现金核销');
      }

      const verifiedAt = new Date();
      await tx.paymentOrder.update({
        where: { id: paymentOrder.id },
        data: {
          status: PrismaPaymentOrderStatusEnum.PAID,
          statusMessage: '现金已核销',
          cashVerifyStatus: PrismaCashVerifyStatusEnum.VERIFIED,
          cashVerifiedAt: verifiedAt,
          paidAt: verifiedAt,
        },
      });

      const updatedOrder = await this.createPaymentRecordAndApplyOrder(tx, order, {
        amount: payable,
        channel: 'cash',
        status: PrismaPaymentRecordStatusEnum.SUCCESS,
        paidAt: verifiedAt,
      });

      return {
        orderId: updatedOrder.id,
        orderStatus: this.fromPrismaOrderStatus(updatedOrder.status),
        paymentStatus: 'paid',
        verifiedAt: verifiedAt.toISOString(),
      };
    });
  }

  async handleLakalaWebhook(payload: Record<string, unknown>) {
    const gatewayTradeNo = this.readString(
      payload.gatewayTradeNo ?? payload.channelTradeNo ?? payload.txNo ?? payload.tradeNo,
    );
    const externalStatus = this.readString(payload.status ?? payload.tradeStatus ?? payload.result);

    return this.prisma.$transaction(async (tx) => {
      const paymentOrder = gatewayTradeNo
        ? await tx.paymentOrder.findFirst({
            where: { gatewayTradeNo },
            orderBy: { createdAt: 'desc' },
          })
        : null;
      const fallbackOrderId = this.readString(payload.merchantOrderNo ?? payload.orderId);
      const resolvedPaymentOrder =
        paymentOrder ||
        (fallbackOrderId
          ? await tx.paymentOrder.findFirst({
              where: {
                orderId: fallbackOrderId,
                status: PrismaPaymentOrderStatusEnum.PAYING,
              },
              orderBy: [{ lastInitiatedAt: 'desc' }, { createdAt: 'desc' }],
            })
          : null);

      if (!resolvedPaymentOrder) {
        return { code: 'SUCCESS', message: 'OK' };
      }
      if (resolvedPaymentOrder.status === PrismaPaymentOrderStatusEnum.PAID) {
        return { code: 'SUCCESS', message: 'OK' };
      }

      if (externalStatus && ['fail', 'failed', 'closed', 'cancelled', 'expired'].includes(externalStatus.toLowerCase())) {
        await tx.paymentOrder.update({
          where: { id: resolvedPaymentOrder.id },
          data: {
            status: PrismaPaymentOrderStatusEnum.EXPIRED,
            statusMessage: this.readString(payload.message) || '支付未完成，请重新发起',
          },
        });
        return { code: 'SUCCESS', message: 'OK' };
      }

      const order = await tx.order.findUnique({ where: { id: resolvedPaymentOrder.orderId } });
      if (!order || order.deletedAt) {
        return { code: 'SUCCESS', message: 'OK' };
      }

      const existingPayment = gatewayTradeNo
        ? await tx.payment.findUnique({ where: { gatewayTradeNo } })
        : null;
      if (existingPayment) {
        return { code: 'SUCCESS', message: 'OK' };
      }

      const fee = this.decimal(
        this.readString(payload.fee ?? payload.channelFee ?? payload.serviceFee) ?? '0',
      );
      const amount = this.decimal(resolvedPaymentOrder.amount);
      const net = amount.minus(fee);
      const paidAt = this.parseDateTime(this.readString(payload.paidAt ?? payload.payTime)) ?? new Date();

      await tx.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          customer: this.cut(order.customer, 100),
          amount: this.toPrismaDecimal(amount),
          channel: 'lakala',
          fee: this.toPrismaDecimal(fee),
          net: this.toPrismaDecimal(net),
          status: PrismaPaymentRecordStatusEnum.SUCCESS,
          gatewayTradeNo,
          paidAt,
        },
      });

      await tx.paymentOrder.update({
        where: { id: resolvedPaymentOrder.id },
        data: {
          status: PrismaPaymentOrderStatusEnum.PAID,
          paymentMethod: PrismaPaymentMethodEnum.ONLINE,
          channel: PrismaPaymentChannelEnum.LAKALA,
          statusMessage: '支付成功',
          paidAt,
        },
      });

      await this.applyOrderPaidAmount(tx, order, amount);
      return { code: 'SUCCESS', message: 'OK' };
    });
  }

  private async getPublicOrderByToken(token: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        qrCodeToken: token,
        deletedAt: null,
      },
      include: {
        tenant: {
          include: { generalSettings: true },
        },
        lineItems: true,
      },
    });

    if (!order) {
      throw new BusinessException(40401, '路由无效，对应订单不存在', 404);
    }

    return order;
  }

  private async getLatestPaymentOrder(
    orderId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return client.paymentOrder.findFirst({
      where: { orderId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async expireIfNeeded(
    paymentOrder: Awaited<ReturnType<PaymentService['getLatestPaymentOrder']>>,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (!paymentOrder || !shouldExpirePayingPaymentOrder(paymentOrder)) {
      return paymentOrder;
    }

    return client.paymentOrder.update({
      where: { id: paymentOrder.id },
      data: {
        status: PrismaPaymentOrderStatusEnum.EXPIRED,
        statusMessage: '支付超时，请重新发起',
      },
    });
  }
  private toOfflinePaymentInfo(
    paymentOrder: {
      paymentMethod: PrismaPaymentMethodEnum | null;
      offlineRemark: string | null;
      cashVerifyStatus: PrismaCashVerifyStatusEnum | null;
      offlineSubmittedAt: Date | null;
      cashVerifiedAt: Date | null;
    } | null,
  ): OfflinePaymentInfo | null {
    if (!paymentOrder?.offlineSubmittedAt || !paymentOrder.paymentMethod) {
      return null;
    }
    const selected = this.fromPrismaPaymentMethod(paymentOrder.paymentMethod);
    if (!selected || (selected !== PaymentMethodEnum.CASH && selected !== PaymentMethodEnum.OTHER_PAID)) {
      return null;
    }

    return {
      method:
        selected === PaymentMethodEnum.CASH
          ? OfflinePaymentMethodEnum.CASH
          : OfflinePaymentMethodEnum.OTHER_PAID,
      remark: paymentOrder.offlineRemark ?? '',
      cashVerifyStatus: paymentOrder.cashVerifyStatus
        ? this.fromPrismaCashVerifyStatus(paymentOrder.cashVerifyStatus)
        : null,
      cashVerifyStatusText: this.cashVerifyStatusText(paymentOrder.cashVerifyStatus),
      submittedAt: paymentOrder.offlineSubmittedAt.toISOString(),
      verifiedAt: paymentOrder.cashVerifiedAt?.toISOString() ?? null,
    };
  }

  private async createPaymentRecordAndApplyOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      tenantId: string;
      customer: string;
      amount: Prisma.Decimal;
      paid: Prisma.Decimal;
      payType: PrismaOrderPayTypeEnum;
    },
    input: {
      amount: Decimal;
      channel: string;
      status: PrismaPaymentRecordStatusEnum;
      paidAt: Date;
    },
  ) {
    await tx.payment.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        customer: this.cut(order.customer, 100),
        amount: this.toPrismaDecimal(input.amount),
        channel: input.channel,
        fee: this.toPrismaDecimal(new Decimal(0)),
        net: this.toPrismaDecimal(input.amount),
        status: input.status,
        paidAt: input.paidAt,
      },
    });

    return this.applyOrderPaidAmount(tx, order, input.amount);
  }

  private async applyOrderPaidAmount(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      amount: Prisma.Decimal;
      paid: Prisma.Decimal;
      payType: PrismaOrderPayTypeEnum;
    },
    delta: Decimal,
  ) {
    const newPaid = this.decimal(order.paid).plus(delta);
    const nextStatus = this.deriveOrderStatus(
      this.fromPrismaOrderPayType(order.payType),
      this.decimal(order.amount),
      newPaid,
    );

    return tx.order.update({
      where: { id: order.id },
      data: {
        paid: this.toPrismaDecimal(newPaid),
        status: this.toPrismaOrderStatus(nextStatus),
      },
    });
  }

  private getRemainingAmount(order: { amount: Prisma.Decimal; paid: Prisma.Decimal }): Decimal {
    return this.decimal(order.amount).minus(this.decimal(order.paid));
  }

  private async getAdminPayments(
    query: PaymentListQuery,
  ): Promise<PaginatedResponse<AdminPaymentRecordItem>> {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const where: Prisma.PaymentWhereInput = {};

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      const orConditions: Prisma.PaymentWhereInput[] = [
        { customer: { contains: keyword, mode: 'insensitive' } },
        { tenant: { name: { contains: keyword, mode: 'insensitive' } } },
      ];
      if (this.isUuid(keyword)) {
        orConditions.push({ orderId: keyword });
      }
      where.OR = orConditions;
    }
    if (query.channel?.trim()) {
      where.channel = query.channel.trim();
    }

    const [records, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { tenant: true },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      list: records.map((item) => ({
        id: item.id,
        tenant: item.tenant.name,
        orderId: item.orderId,
        customer: item.customer,
        amount: this.toMoneyNumber(item.amount),
        channel: item.channel,
        fee: this.toMoneyNumber(item.fee),
        net: this.toMoneyNumber(item.net),
        time: item.paidAt.toISOString(),
        status: this.fromPrismaPaymentRecordStatus(item.status),
      })),
      total,
      page,
      pageSize,
    };
  }

  private async getAdminPaymentSummary(): Promise<PaymentSummaryResponse> {
    const start = dayjs().startOf('day').toDate();
    const end = dayjs().endOf('day').toDate();
    const where: Prisma.PaymentWhereInput = {
      paidAt: {
        gte: start,
        lte: end,
      },
    };

    const [aggregate, totalCount, abnormalCount] = await Promise.all([
      this.prisma.payment.aggregate({
        where,
        _sum: {
          amount: true,
          fee: true,
          net: true,
        },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({
        where: {
          ...where,
          status: { not: PrismaPaymentRecordStatusEnum.SUCCESS },
        },
      }),
    ]);

    return {
      totalAmount: this.toMoneyNumber(aggregate._sum.amount ?? 0),
      totalFee: this.toMoneyNumber(aggregate._sum.fee ?? 0),
      totalNet: this.toMoneyNumber(aggregate._sum.net ?? 0),
      totalCount,
      abnormalCount,
    };
  }

  private deriveOrderStatus(payType: OrderPayType, amount: Decimal, paid: Decimal): OrderStatus {
    if (amount.gt(0) && paid.gte(amount)) return OrderStatusEnum.PAID;
    if (paid.gt(0)) return OrderStatusEnum.PARTIAL;
    if (payType === OrderPayTypeEnum.CREDIT) return OrderStatusEnum.CREDIT;
    return OrderStatusEnum.PENDING;
  }

  private parseOfflinePaymentMethod(value: string): OfflinePaymentMethod {
    if (value === OfflinePaymentMethodEnum.CASH) return OfflinePaymentMethodEnum.CASH;
    if (value === OfflinePaymentMethodEnum.OTHER_PAID) return OfflinePaymentMethodEnum.OTHER_PAID;
    throw new BusinessException(40001, 'paymentMethod 不是合法值', 400);
  }

  private buildCashierUrl(gatewayTradeNo: string): string {
    const prefix = process.env.LAKALA_CASHIER_URL_PREFIX ?? 'https://cashier.lakala.com/pay?tradeNo=';
    return `${prefix}${encodeURIComponent(gatewayTradeNo)}`;
  }

  private generateGatewayTradeNo(): string {
    return `lakala_${Date.now()}_${randomBytes(6).toString('hex')}`;
  }

  private fromPrismaPaymentMethod(
    method: PrismaPaymentMethodEnum | null | undefined,
  ): PaymentMethod | null {
    switch (method) {
      case PrismaPaymentMethodEnum.ONLINE:
        return PaymentMethodEnum.ONLINE;
      case PrismaPaymentMethodEnum.CASH:
        return PaymentMethodEnum.CASH;
      case PrismaPaymentMethodEnum.OTHER_PAID:
        return PaymentMethodEnum.OTHER_PAID;
      default:
        return null;
    }
  }

  private fromPrismaPaymentOrderStatus(status: PrismaPaymentOrderStatusEnum): PaymentOrderStatus {
    switch (status) {
      case PrismaPaymentOrderStatusEnum.PAYING:
        return PaymentOrderStatusEnum.PAYING;
      case PrismaPaymentOrderStatusEnum.PENDING_VERIFICATION:
        return PaymentOrderStatusEnum.PENDING_VERIFICATION;
      case PrismaPaymentOrderStatusEnum.PAID:
        return PaymentOrderStatusEnum.PAID;
      case PrismaPaymentOrderStatusEnum.EXPIRED:
        return PaymentOrderStatusEnum.EXPIRED;
      case PrismaPaymentOrderStatusEnum.UNPAID:
      default:
        return PaymentOrderStatusEnum.UNPAID;
    }
  }

  private fromPrismaCashVerifyStatus(
    status: PrismaCashVerifyStatusEnum,
  ): (typeof CashVerifyStatusEnum)[keyof typeof CashVerifyStatusEnum] {
    return status === PrismaCashVerifyStatusEnum.VERIFIED
      ? CashVerifyStatusEnum.VERIFIED
      : CashVerifyStatusEnum.PENDING;
  }

  private fromPrismaPaymentRecordStatus(
    status: PrismaPaymentRecordStatusEnum,
  ): PaymentRecordStatus {
    switch (status) {
      case PrismaPaymentRecordStatusEnum.PARTIAL:
        return PaymentRecordStatusEnum.PARTIAL;
      case PrismaPaymentRecordStatusEnum.PENDING:
        return PaymentRecordStatusEnum.PENDING;
      case PrismaPaymentRecordStatusEnum.FAILED:
        return PaymentRecordStatusEnum.FAILED;
      case PrismaPaymentRecordStatusEnum.SUCCESS:
      default:
        return PaymentRecordStatusEnum.SUCCESS;
    }
  }

  private cashVerifyStatusText(status: PrismaCashVerifyStatusEnum | null): string {
    if (status === PrismaCashVerifyStatusEnum.VERIFIED) return '已核销';
    if (status === PrismaCashVerifyStatusEnum.PENDING) return '待核销';
    return '无需核销';
  }

  private fromPrismaOrderPayType(payType: PrismaOrderPayTypeEnum): OrderPayType {
    return payType === PrismaOrderPayTypeEnum.CREDIT ? OrderPayTypeEnum.CREDIT : OrderPayTypeEnum.CASH;
  }

  private toPrismaOrderStatus(status: OrderStatus): PrismaOrderStatusEnum {
    switch (status) {
      case OrderStatusEnum.PARTIAL:
        return PrismaOrderStatusEnum.PARTIAL;
      case OrderStatusEnum.PAID:
        return PrismaOrderStatusEnum.PAID;
      case OrderStatusEnum.EXPIRED:
        return PrismaOrderStatusEnum.EXPIRED;
      case OrderStatusEnum.CREDIT:
        return PrismaOrderStatusEnum.CREDIT;
      case OrderStatusEnum.PENDING:
      default:
        return PrismaOrderStatusEnum.PENDING;
    }
  }

  private fromPrismaOrderStatus(status: PrismaOrderStatusEnum): OrderStatus {
    switch (status) {
      case PrismaOrderStatusEnum.PARTIAL:
        return OrderStatusEnum.PARTIAL;
      case PrismaOrderStatusEnum.PAID:
        return OrderStatusEnum.PAID;
      case PrismaOrderStatusEnum.EXPIRED:
        return OrderStatusEnum.EXPIRED;
      case PrismaOrderStatusEnum.CREDIT:
        return OrderStatusEnum.CREDIT;
      case PrismaOrderStatusEnum.PENDING:
      default:
        return OrderStatusEnum.PENDING;
    }
  }

  private decimal(value: Prisma.Decimal | Decimal.Value): Decimal {
    return new Decimal(value.toString());
  }

  private toPrismaDecimal(value: Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value.toString());
  }

  private toMoneyNumber(value: Prisma.Decimal | Decimal.Value): number {
    return Number(this.decimal(value).toFixed(2));
  }

  private toDecimalNumber(value: Prisma.Decimal | Decimal.Value, scale: number): number {
    return Number(this.decimal(value).toFixed(scale));
  }

  private parseDateTime(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private readString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const text = String(value).trim();
    return text ? text : undefined;
  }

  private normalizePage(value?: number): number {
    return value && value > 0 ? value : 1;
  }

  private normalizePageSize(value?: number): number {
    if (!value || value <= 0) return 20;
    return Math.min(value, 200);
  }

  private cut(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) : value;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private getTenantId(currentUser: JwtPayload): string {
    if (!currentUser.tenantId) {
      throw new ForbiddenException('当前登录态不属于租户侧，无法操作支付功能');
    }
    return currentUser.tenantId;
  }
}
