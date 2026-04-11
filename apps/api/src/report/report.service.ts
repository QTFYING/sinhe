import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AnalyticsDashboardResponse,
  DailyTrendItem,
  LiveFeedEntryItem,
  MonthlyTrendItem,
} from '@shou/types/contracts';
import { OrderPayTypeEnum, OrderStatusEnum, UserRoleEnum } from '@prisma/client';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';
import { JwtPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyTrend(currentUser: JwtPayload): Promise<DailyTrendItem[]> {
    const tenantId = this.getTenantId(currentUser);
    const start = dayjs().subtract(6, 'day').startOf('day');
    const end = dayjs().endOf('day');

    const [orders, payments] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenantId,
          deletedAt: null,
          date: { gte: start.toDate(), lte: end.toDate() },
        },
        select: { date: true, amount: true },
      }),
      this.prisma.payment.findMany({
        where: {
          tenantId,
          paidAt: { gte: start.toDate(), lte: end.toDate() },
        },
        select: { paidAt: true, amount: true },
      }),
    ]);

    return Array.from({ length: 7 }, (_, index) => {
      const current = start.add(index, 'day');
      const receivableAmount = orders
        .filter((item) => dayjs(item.date).isSame(current, 'day'))
        .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
      const receivedAmount = payments
        .filter((item) => dayjs(item.paidAt).isSame(current, 'day'))
        .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));

      return {
        day: current.format('MM-DD'),
        receivableAmount: Number(receivableAmount.toFixed(2)),
        receivedAmount: Number(receivedAmount.toFixed(2)),
      };
    });
  }

  async getMonthlyTrend(currentUser: JwtPayload, months?: number): Promise<MonthlyTrendItem[]> {
    const tenantId = this.getTenantId(currentUser);
    const monthCount = months && months > 0 ? Math.min(months, 12) : 6;
    const start = dayjs().startOf('month').subtract(monthCount - 1, 'month');
    const end = dayjs().endOf('month');

    const [orders, payments] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          tenantId,
          deletedAt: null,
          date: { gte: start.toDate(), lte: end.toDate() },
        },
        select: { date: true, amount: true },
      }),
      this.prisma.payment.findMany({
        where: {
          tenantId,
          paidAt: { gte: start.toDate(), lte: end.toDate() },
        },
        select: { paidAt: true, amount: true },
      }),
    ]);

    return Array.from({ length: monthCount }, (_, index) => {
      const current = start.add(index, 'month');
      const receivableAmount = orders
        .filter((item) => dayjs(item.date).isSame(current, 'month'))
        .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));
      const receivedAmount = payments
        .filter((item) => dayjs(item.paidAt).isSame(current, 'month'))
        .reduce((sum, item) => sum.plus(item.amount.toString()), new Decimal(0));

      return {
        month: current.format('M月'),
        receivableAmount: Number(receivableAmount.toFixed(2)),
        receivedAmount: Number(receivedAmount.toFixed(2)),
      };
    });
  }

  async getLivePayments(currentUser: JwtPayload): Promise<LiveFeedEntryItem[]> {
    const tenantId = this.getTenantId(currentUser);
    const start = dayjs().startOf('day').toDate();

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        paidAt: { gte: start },
      },
      orderBy: { paidAt: 'desc' },
      take: 20,
      select: {
        paidAt: true,
        customer: true,
        amount: true,
        status: true,
      },
    });

    return payments.map((item) => ({
      time: dayjs(item.paidAt).format('HH:mm'),
      customer: item.customer,
      amount: Number(new Decimal(item.amount.toString()).toFixed(2)),
      status: this.toLiveStatus(item.status),
    }));
  }

  async getDashboard(currentUser: JwtPayload): Promise<AnalyticsDashboardResponse> {
    const tenantId = this.getTenantId(currentUser);
    const todayStart = dayjs().startOf('day');
    const todayEnd = dayjs().endOf('day');
    const weekEnd = dayjs().add(7, 'day').endOf('day');

    const [todayOrders, todayPayments, pendingPrintCount, creditDueSoonCount, partialPaymentCount] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            tenantId,
            deletedAt: null,
            date: { gte: todayStart.toDate(), lte: todayEnd.toDate() },
          },
          select: { amount: true },
        }),
        this.prisma.payment.findMany({
          where: {
            tenantId,
            paidAt: { gte: todayStart.toDate(), lte: todayEnd.toDate() },
          },
          select: { amount: true },
        }),
        this.prisma.order.count({
          where: {
            tenantId,
            deletedAt: null,
            voided: false,
            prints: 0,
            status: { in: [OrderStatusEnum.PENDING, OrderStatusEnum.PARTIAL, OrderStatusEnum.CREDIT] },
          },
        }),
        this.prisma.order.count({
          where: {
            tenantId,
            deletedAt: null,
            voided: false,
            payType: OrderPayTypeEnum.CREDIT,
            status: { not: OrderStatusEnum.PAID },
            creditDueDate: { gte: todayStart.toDate(), lte: weekEnd.toDate() },
          },
        }),
        this.prisma.order.count({
          where: {
            tenantId,
            deletedAt: null,
            voided: false,
            status: OrderStatusEnum.PARTIAL,
          },
        }),
      ]);

    const todayReceivable = todayOrders.reduce(
      (sum, item) => sum.plus(item.amount.toString()),
      new Decimal(0),
    );
    const todayReceived = todayPayments.reduce(
      (sum, item) => sum.plus(item.amount.toString()),
      new Decimal(0),
    );
    const todayPending = Decimal.max(todayReceivable.minus(todayReceived), 0);
    const collectionRate = todayReceivable.gt(0)
      ? Number(todayReceived.div(todayReceivable).mul(100).toFixed(2))
      : 0;

    return {
      todayReceivable: Number(todayReceivable.toFixed(2)),
      todayReceived: Number(todayReceived.toFixed(2)),
      todayPending: Number(todayPending.toFixed(2)),
      collectionRate,
      pendingPrintCount,
      creditDueSoonCount,
      partialPaymentCount,
      roleTitle: this.resolveRoleTitle(currentUser.role),
    };
  }

  private toLiveStatus(status: string): string {
    switch (status) {
      case 'SUCCESS':
        return 'paid';
      case 'PARTIAL':
        return 'partial';
      case 'PENDING':
        return 'pending';
      case 'FAILED':
      default:
        return 'pending';
    }
  }

  private resolveRoleTitle(role: UserRoleEnum): string {
    switch (role) {
      case UserRoleEnum.TENANT_OPERATOR:
        return '今日打单任务';
      case UserRoleEnum.TENANT_FINANCE:
        return '财务对账中心';
      case UserRoleEnum.TENANT_VIEWER:
        return '审计只读视图';
      case UserRoleEnum.TENANT_OWNER:
      default:
        return '今日收款总览';
    }
  }

  private getTenantId(currentUser: JwtPayload): string {
    if (!currentUser.tenantId) {
      throw new BadRequestException('当前登录态不属于租户侧，无法读取分析数据');
    }
    return currentUser.tenantId;
  }
}
