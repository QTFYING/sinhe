import {
  OrderStatusEnum as PrismaOrderStatusEnum,
  PaymentOrderStatusEnum as PrismaPaymentOrderStatusEnum,
  type Prisma,
} from '@prisma/client';
import type { PaymentOrderStatus } from '@shou/types/enums';
import Decimal from 'decimal.js';
import dayjs from 'dayjs';

export const PAYMENT_PAYING_EXPIRE_MINUTES = 5;

export function shouldExpirePayingPaymentOrder(
  paymentOrder: {
    status: PrismaPaymentOrderStatusEnum;
    lastInitiatedAt: Date | null;
  } | null,
  now: Date = new Date(),
): boolean {
  return Boolean(
    paymentOrder &&
      paymentOrder.status === PrismaPaymentOrderStatusEnum.PAYING &&
      paymentOrder.lastInitiatedAt &&
      dayjs(now).diff(dayjs(paymentOrder.lastInitiatedAt), 'minute') >= PAYMENT_PAYING_EXPIRE_MINUTES,
  );
}

export function resolvePaymentOrderStatus(
  order: {
    status: PrismaOrderStatusEnum;
    voided: boolean;
    amount: Prisma.Decimal | Decimal.Value;
    paid: Prisma.Decimal | Decimal.Value;
  },
  paymentOrder: {
    status: PrismaPaymentOrderStatusEnum;
  } | null,
): PaymentOrderStatus {
  const amountDecimal = new Decimal(order.amount.toString());
  const paidDecimal = new Decimal(order.paid.toString());

  if (order.voided || order.status === PrismaOrderStatusEnum.EXPIRED) {
    return 'expired';
  }
  if (paidDecimal.gte(amountDecimal) || order.status === PrismaOrderStatusEnum.PAID) {
    return 'paid';
  }
  if (!paymentOrder) {
    return 'unpaid';
  }

  switch (paymentOrder.status) {
    case PrismaPaymentOrderStatusEnum.PAYING:
      return 'paying';
    case PrismaPaymentOrderStatusEnum.PENDING_VERIFICATION:
      return 'pending_verification';
    case PrismaPaymentOrderStatusEnum.PAID:
      return 'paid';
    case PrismaPaymentOrderStatusEnum.EXPIRED:
      return 'expired';
    case PrismaPaymentOrderStatusEnum.UNPAID:
    default:
      return 'unpaid';
  }
}
