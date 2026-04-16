import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditResultEnum as PrismaAuditResultEnum,
  AuditTargetTypeEnum as PrismaAuditTargetTypeEnum,
  OrderPayTypeEnum as PrismaOrderPayTypeEnum,
  OrderReminderStatusEnum as PrismaOrderReminderStatusEnum,
  OrderStatusEnum as PrismaOrderStatusEnum,
  PaymentOrderStatusEnum,
  PaymentRecordStatusEnum,
  Prisma,
} from '@prisma/client';
import type {
  AdminOrderItem,
  CreateOrderReceiptRequest,
  CreateOrderReceiptResponse,
  CreateOrderReminderRequest,
  CreateOrderReminderResponse,
  CreateOrderRequest,
  CreditOrderItem,
  OrderLineItem,
  OrderPrintRecordRequest,
  OrderPrintRecordResponse,
  TenantOrderItem,
  UpdateOrderRequest,
  VoidOrderRequest,
} from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import {
  CreditOrderStatusEnum,
  OrderPayTypeEnum,
  OrderStatusEnum,
  type CreditOrderStatus,
  type OrderPayType,
  type OrderStatus,
} from '@shou/types/enums';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import { randomBytes } from 'crypto';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { IdGeneratorService } from '../id-generator/id-generator.service';
import { ID_CONFIG } from '../id-generator/id-generator.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { deriveOrderStatus, resolveCreditOrderStatus } from './order.domain';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idGen: IdGeneratorService,
  ) {}

  async findAll(
    currentUser: JwtPayload,
    query: ListOrdersQueryDto,
  ): Promise<PaginatedResponse<TenantOrderItem | AdminOrderItem>> {
    if (!currentUser.tenantId) {
      return this.getAdminOrders(query);
    }

    const tenantId = this.getTenantId(currentUser);
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const where = this.buildOrderListWhere(tenantId, query);

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { lineItems: true },
        orderBy: [{ orderTime: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list: orders.map((order) => this.toTenantOrder(order)),
      total,
      page,
      pageSize,
    };
  }

  async getOrder(orderId: string, currentUser: JwtPayload): Promise<TenantOrderItem | AdminOrderItem> {
    if (!currentUser.tenantId) {
      return this.getAdminOrder(orderId);
    }

    const tenantId = this.getTenantId(currentUser);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId, deletedAt: null },
      include: { lineItems: true },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return this.toTenantOrder(order);
  }

  async createOrder(
    currentUser: JwtPayload,
    request: CreateOrderRequest,
  ): Promise<TenantOrderItem> {
    const tenantId = this.getTenantId(currentUser);
    const amount = this.toMoney(request.amount, 'amount');
    const paid = this.toMoney(request.paid ?? 0, 'paid', true);
    if (paid.gt(amount)) {
      throw new BadRequestException('paid 不能大于 amount');
    }

    const payType = request.payType ?? OrderPayTypeEnum.CASH;
    const status = this.resolveRequestedStatus(request.status, payType, amount, paid, false);
    const orderDate = this.parseDate(request.date, 'date') ?? new Date();
    const customer = this.normalizeRequiredText(request.customer, 'customer', 100);
    const customerPhone = request.customerPhone?.trim() ? this.cut(request.customerPhone.trim(), 30) : '';
    const customerAddress = request.customerAddress?.trim() ? this.cut(request.customerAddress.trim(), 255) : '';

    const orderId = await this.idGen.nextDailyId(ID_CONFIG.ORDER.prefix, ID_CONFIG.ORDER.digits);
    const created = await this.prisma.order.create({
      data: {
        id: orderId,
        tenantId,
        qrCodeToken: this.generateQrCodeToken(),
        customer,
        customerPhone,
        customerAddress,
        totalAmount: this.toPrismaDecimal(amount),
        paid: this.toPrismaDecimal(paid),
        status: this.toPrismaOrderStatus(status),
        payType: this.toPrismaOrderPayType(payType),
        prints: 0,
        orderTime: orderDate,
      } as unknown as Prisma.OrderCreateInput,
      include: { lineItems: true },
    });

    return this.toTenantOrder(created);
  }

  async updateOrder(
    currentUser: JwtPayload,
    orderId: string,
    request: UpdateOrderRequest,
  ): Promise<TenantOrderItem> {
    const tenantId = this.getTenantId(currentUser);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id: orderId, tenantId, deletedAt: null },
        include: { lineItems: true },
      });

      if (!existing) {
        throw new NotFoundException('订单不存在');
      }
      if (existing.voided) {
        throw new ConflictException('已作废订单不允许更新');
      }
      if (await this.hasSettledFlow(tx, existing.id)) {
        throw new ConflictException('订单已进入支付或入账流程，不允许直接更新');
      }

      const normalizedLineItems = request.lineItems
        ? request.lineItems.map((item) => this.normalizeLineItem(item))
        : undefined;
      const derivedAmount = normalizedLineItems
        ? this.sumLineItemAmount(normalizedLineItems)
        : this.decimal(existing.totalAmount);
      const amount =
        request.amount !== undefined ? this.toMoney(request.amount, 'amount') : derivedAmount;
      if (amount.lte(0)) {
        throw new BadRequestException('amount 必须大于 0');
      }
      if (normalizedLineItems && request.amount !== undefined && !amount.equals(derivedAmount)) {
        throw new BadRequestException('amount 必须与 lineItems 合计金额一致');
      }

      const paid =
        request.paid !== undefined ? this.toMoney(request.paid, 'paid', true) : this.decimal(existing.paid);
      if (paid.gt(amount)) {
        throw new BadRequestException('paid 不能大于 amount');
      }

      const payType = request.payType ?? this.fromPrismaOrderPayType(existing.payType);
      const status = this.resolveRequestedStatus(request.status, payType, amount, paid, false);
      const orderTime = request.date ? this.parseDate(request.date, 'date') : existing.orderTime;
      const updated = await tx.order.update({
        where: { id: existing.id },
        data: {
          customer:
            request.customer !== undefined
              ? this.normalizeRequiredText(request.customer, 'customer', 100)
              : existing.customer,
          customerPhone:
            request.customerPhone !== undefined
              ? this.cut(request.customerPhone.trim(), 30)
              : ((existing as { customerPhone?: string | null }).customerPhone ?? ''),
          customerAddress:
            request.customerAddress !== undefined
              ? this.cut(request.customerAddress.trim(), 255)
              : ((existing as { customerAddress?: string | null }).customerAddress ?? ''),
          totalAmount: this.toPrismaDecimal(amount),
          paid: this.toPrismaDecimal(paid),
          status: this.toPrismaOrderStatus(status),
          payType: this.toPrismaOrderPayType(payType),
          orderTime,
          customerFieldValues:
            request.customFieldValues !== undefined
              ? (request.customFieldValues as unknown as Prisma.InputJsonValue)
              : undefined,
          lineItems: normalizedLineItems
              ? {
                deleteMany: {},
                create: normalizedLineItems.map((item) => this.toLineItemCreateInput(item)),
              }
            : undefined,
        } as unknown as Prisma.OrderUpdateInput,
        include: { lineItems: true },
      });

      return this.toTenantOrder(updated);
    });
  }

  async voidOrder(
    currentUser: JwtPayload,
    orderId: string,
    request: VoidOrderRequest,
  ): Promise<TenantOrderItem> {
    const tenantId = this.getTenantId(currentUser);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId, deletedAt: null },
        include: { lineItems: true },
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }
      if (order.voided) {
        throw new ConflictException('订单已作废');
      }
      if (this.decimal(order.paid).gt(0) || (await this.hasSettledFlow(tx, order.id))) {
        throw new ConflictException('订单已进入支付或入账流程，不允许作废');
      }

      const voided = await tx.order.update({
        where: { id: order.id },
        data: {
          voided: true,
          voidReason: this.normalizeRequiredText(request.voidReason, 'voidReason', 255),
          voidedAt: new Date(),
          status: PrismaOrderStatusEnum.EXPIRED,
        },
        include: { lineItems: true },
      });

      return this.toTenantOrder(voided);
    });
  }

  async createPrintRecord(
    currentUser: JwtPayload,
    request: OrderPrintRecordRequest,
  ): Promise<OrderPrintRecordResponse> {
    const tenantId = this.getTenantId(currentUser);
    const orderIds = this.normalizeUuidArray(request.orderIds, 'orderIds');
    const requestId = request.requestId?.trim() || undefined;

    if (requestId) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const batchId = await this.idGen.nextDailyId(ID_CONFIG.PRINT_RECORD.prefix, ID_CONFIG.PRINT_RECORD.digits);
          const reserved = await tx.printRecordBatch.create({
            data: {
              id: batchId,
              tenantId,
              requestId,
              operatorId: currentUser.userId,
              orderIds: [] as unknown as Prisma.InputJsonValue,
              totalCount: 0,
              successCount: 0,
              remark: request.remark,
            },
          });

          await this.assertAllOrdersOwned(tx, tenantId, orderIds);
          const updated = await tx.order.updateMany({
            where: { tenantId, id: { in: orderIds }, deletedAt: null },
            data: { prints: { increment: 1 } },
          });

          const batch = await tx.printRecordBatch.update({
            where: { id: reserved.id },
            data: {
              orderIds: orderIds as unknown as Prisma.InputJsonValue,
              totalCount: orderIds.length,
              successCount: updated.count,
              remark: request.remark,
            },
          });

          return {
            requestId: batch.requestId,
            totalCount: batch.totalCount,
            successCount: batch.successCount,
            confirmedAt: batch.createdAt.toISOString(),
            remark: batch.remark ?? undefined,
          };
        });
      } catch (error) {
        if (this.isUniqueConflict(error)) {
          const existing = await this.prisma.printRecordBatch.findUnique({
            where: {
              tenantId_requestId: {
                tenantId,
                requestId,
              },
            },
          });
          if (existing) {
            return {
              requestId: existing.requestId,
              totalCount: existing.totalCount,
              successCount: existing.successCount,
              confirmedAt: existing.createdAt.toISOString(),
              remark: existing.remark ?? undefined,
            };
          }
        }
        throw error;
      }
    }

    await this.assertAllOrdersOwned(this.prisma, tenantId, orderIds);
    const updated = await this.prisma.order.updateMany({
      where: { tenantId, id: { in: orderIds }, deletedAt: null },
      data: { prints: { increment: 1 } },
    });

    return {
      totalCount: orderIds.length,
      successCount: updated.count,
      confirmedAt: new Date().toISOString(),
      requestId: undefined,
      remark: request.remark,
    };
  }

  async createReminder(
    currentUser: JwtPayload,
    orderId: string,
    request: CreateOrderReminderRequest,
  ): Promise<CreateOrderReminderResponse> {
    const tenantId = this.getTenantId(currentUser);
    const channels = this.normalizeReminderChannels(request.channels);
    const actor = await this.getActorName(currentUser.userId);

    await this.prisma.$transaction(async (tx) => {
      const count = await tx.order.count({
        where: { id: orderId, tenantId, deletedAt: null },
      });
      if (count === 0) {
        throw new NotFoundException('订单不存在');
      }

      const reminderId = await this.idGen.nextDailyId(ID_CONFIG.ORDER_REMINDER.prefix, ID_CONFIG.ORDER_REMINDER.digits);
      await tx.orderReminder.create({
        data: {
          id: reminderId,
          tenantId,
          orderId,
          operatorId: currentUser.userId,
          channels,
          status: PrismaOrderReminderStatusEnum.SENT,
          sentAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actor,
          action: '创建催款提醒记录',
          target: orderId,
          targetType: PrismaAuditTargetTypeEnum.TENANT,
          tenantId,
          result: PrismaAuditResultEnum.SUCCESS,
        },
      });
    });

    return {
      sent: true,
      channels,
    };
  }

  async getCreditOrders(
    currentUser: JwtPayload,
    page?: number,
    pageSize?: number,
  ): Promise<PaginatedResponse<CreditOrderItem>> {
    const tenantId = this.getTenantId(currentUser);
    const resolvedPage = this.normalizePage(page);
    const resolvedPageSize = this.normalizePageSize(pageSize);
    const where: Prisma.OrderWhereInput = {
      tenantId,
      deletedAt: null,
      voided: false,
      payType: PrismaOrderPayTypeEnum.CREDIT,
      status: { not: PrismaOrderStatusEnum.PAID },
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: [{ creditDueDate: 'asc' }, { orderTime: 'asc' }],
        skip: (resolvedPage - 1) * resolvedPageSize,
        take: resolvedPageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list: orders.map((order) => this.toCreditOrderItem(order)),
      total,
      page: resolvedPage,
      pageSize: resolvedPageSize,
    };
  }

  async createReceipt(
    currentUser: JwtPayload,
    orderId: string,
    request: CreateOrderReceiptRequest,
  ): Promise<CreateOrderReceiptResponse> {
    const tenantId = this.getTenantId(currentUser);

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId, deletedAt: null },
      });

      if (!order) {
        throw new NotFoundException('订单不存在');
      }
      if (order.voided) {
        throw new ConflictException('已作废订单不允许回款');
      }
      if (order.payType !== PrismaOrderPayTypeEnum.CREDIT) {
        throw new BadRequestException('仅账期订单允许创建回款记录');
      }

      const amount = this.decimal(order.totalAmount);
      const paid = this.decimal(order.paid);
      const remaining = amount.minus(paid);
      if (remaining.lte(0)) {
        throw new ConflictException('订单已完成回款，无需重复登记');
      }

      const receiptAmount =
        request.amount !== undefined ? this.toMoney(request.amount, 'amount') : remaining;
      if (receiptAmount.lte(0) || receiptAmount.gt(remaining)) {
        throw new BadRequestException(`回款金额必须在 0.01 到 ${remaining.toFixed(2)} 之间`);
      }

      const newPaid = paid.plus(receiptAmount);
      const nextStatus = this.deriveOrderStatus(
        OrderPayTypeEnum.CREDIT,
        amount,
        newPaid,
        false,
      );
      const paidAt = new Date();
      const paymentId = await this.idGen.nextDailyId(ID_CONFIG.PAYMENT.prefix, ID_CONFIG.PAYMENT.digits);

      await tx.payment.create({
        data: {
          id: paymentId,
          tenantId,
          orderId: order.id,
          customer: this.cut(order.customer, 100),
          amount: this.toPrismaDecimal(receiptAmount),
          channel: 'credit_receipt',
          fee: this.toPrismaDecimal(new Decimal(0)),
          net: this.toPrismaDecimal(receiptAmount),
          status: PaymentRecordStatusEnum.SUCCESS,
          paidAt,
        },
      });

      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          paid: this.toPrismaDecimal(newPaid),
          status: this.toPrismaOrderStatus(nextStatus),
        },
      });

      return {
        orderId: updated.id,
        status: this.fromPrismaOrderStatus(updated.status),
        paid: this.toMoneyNumber(updated.paid),
      };
    });
  }

  private buildOrderListWhere(
    tenantId: string,
    query: ListOrdersQueryDto,
  ): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = this.toPrismaOrderStatus(query.status);
    }
    if (query.payType) {
      where.payType = this.toPrismaOrderPayType(query.payType);
    }
    if (query.templateId) {
      where.mappingTemplateId = BigInt(query.templateId);
    }
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { sourceOrderNo: { contains: keyword, mode: 'insensitive' } },
        { groupKey: { contains: keyword, mode: 'insensitive' } },
        { customer: { contains: keyword, mode: 'insensitive' } },
        { customerPhone: { contains: keyword, mode: 'insensitive' } },
        { customerAddress: { contains: keyword, mode: 'insensitive' } },
      ] as unknown as Prisma.OrderWhereInput[];
    }
    if (query.dateFrom || query.dateTo) {
      where.orderTime = {};
      if (query.dateFrom) {
        where.orderTime.gte = dayjs(query.dateFrom).startOf('day').toDate();
      }
      if (query.dateTo) {
        where.orderTime.lte = dayjs(query.dateTo).endOf('day').toDate();
      }
    }

    return where;
  }

  private async getAdminOrders(
    query: ListOrdersQueryDto,
  ): Promise<PaginatedResponse<AdminOrderItem>> {
    const page = this.normalizePage(query.page);
    const pageSize = this.normalizePageSize(query.pageSize);
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
    };

    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { id: keyword },
        { sourceOrderNo: { contains: keyword, mode: 'insensitive' } },
        { groupKey: { contains: keyword, mode: 'insensitive' } },
        { customer: { contains: keyword, mode: 'insensitive' } },
        { customerPhone: { contains: keyword, mode: 'insensitive' } },
        { customerAddress: { contains: keyword, mode: 'insensitive' } },
        { tenant: { name: { contains: keyword, mode: 'insensitive' } } },
      ] as unknown as Prisma.OrderWhereInput[];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { lineItems: true, tenant: true },
        orderBy: [{ orderTime: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list: orders.map((order) => this.toAdminOrder(order)),
      total,
      page,
      pageSize,
    };
  }

  private async getAdminOrder(orderId: string): Promise<AdminOrderItem> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { lineItems: true, tenant: true },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return this.toAdminOrder(order);
  }

  private async assertAllOrdersOwned(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    orderIds: string[],
  ): Promise<void> {
    const count = await client.order.count({
      where: { tenantId, deletedAt: null, id: { in: orderIds } },
    });
    if (count !== orderIds.length) {
      throw new BadRequestException('存在无效订单 ID 或跨租户订单');
    }
  }

  private async assertOrderExists(tenantId: string, orderId: string): Promise<void> {
    const count = await this.prisma.order.count({
      where: { id: orderId, tenantId, deletedAt: null },
    });
    if (count === 0) {
      throw new NotFoundException('订单不存在');
    }
  }

  private async getActorName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        realName: true,
        account: true,
      },
    });

    return user?.realName || user?.account || userId;
  }

  private async hasSettledFlow(
    client: Prisma.TransactionClient | PrismaService,
    orderId: string,
  ): Promise<boolean> {
    const [payments, paymentOrders] = await Promise.all([
      client.payment.count({ where: { orderId } }),
      client.paymentOrder.count({
        where: {
          orderId,
          status: {
            in: [
              PaymentOrderStatusEnum.PAYING,
              PaymentOrderStatusEnum.PENDING_VERIFICATION,
              PaymentOrderStatusEnum.PAID,
            ],
          },
        },
      }),
    ]);

    return payments > 0 || paymentOrders > 0;
  }

  private normalizeLineItem(item: OrderLineItem): OrderLineItem {
    const quantity = this.toDecimal(item.quantity, 'quantity', 3);
    const unitPrice = this.toMoney(item.unitPrice, 'unitPrice', true);
    const lineAmount = this.toMoney(item.lineAmount, 'lineAmount', true);
    const expected = quantity.mul(unitPrice).toDecimalPlaces(2);

    if (!expected.equals(lineAmount)) {
      throw new BadRequestException('lineAmount 必须等于 quantity * unitPrice');
    }

    return {
      itemId: item.itemId,
      skuId: item.skuId ?? null,
      skuName: this.normalizeRequiredText(item.skuName, 'skuName', 200),
      skuSpec: item.skuSpec?.trim() ? this.cut(item.skuSpec.trim(), 100) : undefined,
      unit: this.normalizeRequiredText(item.unit, 'unit', 20),
      quantity: this.toDecimalNumber(quantity, 3),
      unitPrice: this.toMoneyNumber(unitPrice),
      lineAmount: this.toMoneyNumber(lineAmount),
    };
  }

  private sumLineItemAmount(lineItems: OrderLineItem[]): Decimal {
    return lineItems.reduce(
      (sum, item) => sum.plus(this.toMoney(item.lineAmount, 'lineAmount', true)),
      new Decimal(0),
    );
  }

  private normalizeReminderChannels(channels?: string[]): string[] {
    const allowed = new Set(['sms', 'wechat']);
    const normalized = Array.from(
      new Set((channels ?? ['sms']).map((item) => item.trim()).filter(Boolean)),
    );

    if (normalized.length === 0) {
      return ['sms'];
    }
    if (normalized.some((item) => !allowed.has(item))) {
      throw new BadRequestException('channels 仅支持 sms、wechat');
    }

    return normalized;
  }

  private resolveRequestedStatus(
    requested: OrderStatus | undefined,
    payType: OrderPayType,
    amount: Decimal,
    paid: Decimal,
    voided: boolean,
  ): OrderStatus {
    if (requested === OrderStatusEnum.EXPIRED) {
      throw new BadRequestException('创建或更新订单时不允许直接设置 expired，请改用 PATCH /orders/{id}');
    }

    const derived = this.deriveOrderStatus(payType, amount, paid, voided);
    if (!requested) {
      return derived;
    }
    if (requested !== derived) {
      throw new BadRequestException('status 与 amount、paid、payType 不一致');
    }

    return derived;
  }

  private deriveOrderStatus(
    payType: OrderPayType,
    amount: Decimal,
    paid: Decimal,
    voided: boolean,
  ): OrderStatus {
    return deriveOrderStatus(payType, amount, paid, voided);
  }

  private toTenantOrder(order: {
    id: string;
    sourceOrderNo: string | null;
    groupKey: string | null;
    mappingTemplateId: bigint | null;
    qrCodeToken: string;
    customer: string;
    customerPhone?: string | null;
    customerAddress?: string | null;
    totalAmount: Prisma.Decimal;
    paid: Prisma.Decimal;
    customerFieldValues?: Prisma.JsonValue | null;
    status: PrismaOrderStatusEnum;
    payType: PrismaOrderPayTypeEnum;
    prints: number;
    orderTime: Date;
    voided: boolean;
    voidReason: string | null;
    voidedAt: Date | null;
    lineItems: Array<{
      id: bigint;
      skuId: string | null;
      skuName: string;
      skuSpec: string | null;
      unit: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      lineAmount: Prisma.Decimal;
    }>;
  }): TenantOrderItem {
    return {
      id: order.id,
      sourceOrderNo: order.sourceOrderNo ?? undefined,
      groupKey: order.groupKey ?? undefined,
      mappingTemplateId: order.mappingTemplateId != null ? String(order.mappingTemplateId) : undefined,
      qrCodeToken: order.qrCodeToken,
      customer: order.customer,
      customerPhone: order.customerPhone ?? '',
      customerAddress: order.customerAddress ?? '',
      totalAmount: this.toMoneyNumber(order.totalAmount),
      paid: this.toMoneyNumber(order.paid),
      status: this.fromPrismaOrderStatus(order.status),
      payType: this.fromPrismaOrderPayType(order.payType),
      prints: order.prints,
      orderTime: order.orderTime.toISOString(),
      lineItems: order.lineItems.map((item) => ({
        itemId: String(item.id),
        skuId: item.skuId,
        skuName: item.skuName,
        skuSpec: item.skuSpec ?? undefined,
        unit: item.unit,
        quantity: this.toDecimalNumber(item.quantity, 3),
        unitPrice: this.toMoneyNumber(item.unitPrice),
        lineAmount: this.toMoneyNumber(item.lineAmount),
      })),
      customerFieldValues: this.toCustomerFieldValues(order.customerFieldValues ?? null),
      voided: order.voided,
      voidReason: order.voidReason ?? undefined,
      voidedAt: order.voidedAt?.toISOString(),
    };
  }

  private toCreditOrderItem(order: {
    id: string;
    customer: string;
    totalAmount: Prisma.Decimal;
    orderTime: Date;
    creditDays: number | null;
    creditDueDate: Date | null;
  }): CreditOrderItem {
    const dueDate = order.creditDueDate ?? dayjs(order.orderTime).add(order.creditDays ?? 0, 'day').toDate();
    return {
      id: order.id,
      customer: order.customer,
      amount: this.toMoneyNumber(order.totalAmount),
      date: order.orderTime.toISOString(),
      creditDays: order.creditDays ?? 0,
      dueDate: dueDate.toISOString(),
      creditStatus: this.resolveCreditStatus(dueDate),
    };
  }

  private toAdminOrder(order: {
    id: string;
    sourceOrderNo: string | null;
    groupKey: string | null;
    mappingTemplateId: bigint | null;
    qrCodeToken: string;
    customer: string;
    customerPhone?: string | null;
    customerAddress?: string | null;
    totalAmount: Prisma.Decimal;
    paid: Prisma.Decimal;
    customerFieldValues?: Prisma.JsonValue | null;
    status: PrismaOrderStatusEnum;
    payType: PrismaOrderPayTypeEnum;
    orderTime: Date;
    voided: boolean;
    voidReason: string | null;
    voidedAt: Date | null;
    lineItems: Array<{
      id: bigint;
      skuId: string | null;
      skuName: string;
      skuSpec: string | null;
      unit: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      lineAmount: Prisma.Decimal;
    }>;
    tenant: {
      name: string;
    };
  }): AdminOrderItem {
    return {
      id: order.id,
      tenant: order.tenant.name,
      sourceOrderNo: order.sourceOrderNo ?? undefined,
      groupKey: order.groupKey ?? undefined,
      mappingTemplateId: order.mappingTemplateId != null ? String(order.mappingTemplateId) : undefined,
      qrCodeToken: order.qrCodeToken,
      customer: order.customer,
      customerPhone: order.customerPhone ?? '',
      customerAddress: order.customerAddress ?? '',
      totalAmount: this.toMoneyNumber(order.totalAmount),
      lineItems: order.lineItems.map((item) => ({
        itemId: String(item.id),
        skuId: item.skuId,
        skuName: item.skuName,
        skuSpec: item.skuSpec ?? undefined,
        unit: item.unit,
        quantity: this.toDecimalNumber(item.quantity, 3),
        unitPrice: this.toMoneyNumber(item.unitPrice),
        lineAmount: this.toMoneyNumber(item.lineAmount),
      })),
      customerFieldValues: this.toCustomerFieldValues(order.customerFieldValues ?? null),
      paid: this.toMoneyNumber(order.paid),
      status: this.fromPrismaOrderStatus(order.status),
      payType: this.fromPrismaOrderPayType(order.payType),
      orderTime: order.orderTime.toISOString(),
      voided: order.voided,
      voidReason: order.voidReason ?? undefined,
      voidedAt: order.voidedAt?.toISOString(),
    };
  }

  private resolveCreditStatus(dueDate: Date): CreditOrderStatus {
    return resolveCreditOrderStatus(dueDate);
  }

  private toLineItemCreateInput(item: OrderLineItem): Prisma.OrderItemCreateWithoutOrderInput {
    return {
      skuId: item.skuId ?? null,
      skuName: item.skuName,
      skuSpec: item.skuSpec,
      unit: item.unit,
      quantity: this.toPrismaDecimal(this.toDecimal(item.quantity, 'quantity', 3)),
      unitPrice: this.toPrismaDecimal(this.toMoney(item.unitPrice, 'unitPrice', true)),
      lineAmount: this.toPrismaDecimal(this.toMoney(item.lineAmount, 'lineAmount', true)),
    };
  }

  private toCustomerFieldValues(value: Prisma.JsonValue | null): Record<string, string> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== null && item !== undefined)
        .map(([key, item]) => [key, String(item)]),
    );
  }

  private toPrismaOrderStatus(status: OrderStatus): PrismaOrderStatusEnum {
    switch (status) {
      case OrderStatusEnum.PENDING:
        return PrismaOrderStatusEnum.PENDING;
      case OrderStatusEnum.PARTIAL:
        return PrismaOrderStatusEnum.PARTIAL;
      case OrderStatusEnum.PAID:
        return PrismaOrderStatusEnum.PAID;
      case OrderStatusEnum.EXPIRED:
        return PrismaOrderStatusEnum.EXPIRED;
      case OrderStatusEnum.CREDIT:
        return PrismaOrderStatusEnum.CREDIT;
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

  private toPrismaOrderPayType(payType: OrderPayType): PrismaOrderPayTypeEnum {
    return payType === OrderPayTypeEnum.CREDIT
      ? PrismaOrderPayTypeEnum.CREDIT
      : PrismaOrderPayTypeEnum.CASH;
  }

  private fromPrismaOrderPayType(payType: PrismaOrderPayTypeEnum): OrderPayType {
    return payType === PrismaOrderPayTypeEnum.CREDIT
      ? OrderPayTypeEnum.CREDIT
      : OrderPayTypeEnum.CASH;
  }

  private decimal(value: Prisma.Decimal | Decimal.Value): Decimal {
    return new Decimal(value.toString());
  }

  private toDecimal(
    value: number,
    label: string,
    scale: number,
    allowZero = false,
  ): Decimal {
    if (!Number.isFinite(value)) {
      throw new BadRequestException(`${label} 必须是合法数字`);
    }

    const decimal = new Decimal(String(value)).toDecimalPlaces(scale);
    if (allowZero ? decimal.lt(0) : decimal.lte(0)) {
      throw new BadRequestException(`${label} 必须${allowZero ? '大于等于' : '大于'} 0`);
    }

    return decimal;
  }

  private toMoney(value: number, label: string, allowZero = false): Decimal {
    return this.toDecimal(value, label, 2, allowZero);
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

  private parseDate(value: string | undefined, label: string): Date | undefined {
    if (!value) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${label} 不是合法日期`);
    }

    return date;
  }

  private normalizeUuidArray(values: string[], label: string): string[] {
    const normalized = Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
    if (normalized.length === 0) {
      throw new BadRequestException(`${label} 不能为空`);
    }

    return normalized;
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

  private normalizeRequiredText(value: string, label: string, max: number): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${label} 不能为空`);
    }

    return this.cut(trimmed, max);
  }

  private generateQrCodeToken(): string {
    return randomBytes(32).toString('hex');
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private getTenantId(currentUser: JwtPayload): string {
    if (!currentUser.tenantId) {
      throw new ForbiddenException('当前登录态不属于租户侧，无法操作订单');
    }

    return currentUser.tenantId;
  }
}
