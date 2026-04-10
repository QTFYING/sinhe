import type { EnumValue } from './common'

/**
 * 支付方式（H5 用户选择或线下登记）
 */
export const PaymentMethodEnum = {
  /** 在线支付 */
  ONLINE: 'ONLINE',
  /** 现金支付 */
  CASH: 'CASH',
  /** 其他方式已支付 */
  OTHER_PAID: 'OTHER_PAID',
} as const

export type PaymentMethod = EnumValue<typeof PaymentMethodEnum>

/**
 * 线下支付方式子集
 */
export const OfflinePaymentMethodEnum = {
  /** 现金支付 */
  CASH: 'CASH',
  /** 其他方式已支付 */
  OTHER_PAID: 'OTHER_PAID',
} as const

export type OfflinePaymentMethod = EnumValue<typeof OfflinePaymentMethodEnum>

/**
 * 支付通道
 */
export const PaymentChannelEnum = {
  /** 微信 JSAPI */
  WX_JSAPI: 'WX_JSAPI',
  /** 支付宝 H5 */
  ALI_H5: 'ALI_H5',
  /** 直连网关 */
  DIRECT: 'DIRECT',
} as const

export type PaymentChannel = EnumValue<typeof PaymentChannelEnum>

/**
 * H5 支付单状态
 */
export const PaymentOrderStatusEnum = {
  /** 待支付 */
  UNPAID: 'UNPAID',
  /** 支付中 */
  PAYING: 'PAYING',
  /** 待核销 */
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  /** 已完成 */
  PAID: 'PAID',
  /** 已过期/已关闭 */
  EXPIRED: 'EXPIRED',
} as const

export type PaymentOrderStatus = EnumValue<typeof PaymentOrderStatusEnum>

/**
 * 现金核销状态
 */
export const CashVerifyStatusEnum = {
  /** 待核销 */
  PENDING: 'PENDING',
  /** 已核销 */
  VERIFIED: 'VERIFIED',
} as const

export type CashVerifyStatus = EnumValue<typeof CashVerifyStatusEnum>

/**
 * 支付流水状态
 */
export const PaymentRecordStatusEnum = {
  /** 成功 */
  SUCCESS: 'SUCCESS',
  /** 部分 */
  PARTIAL: 'PARTIAL',
  /** 处理中 */
  PENDING: 'PENDING',
  /** 失败 */
  FAILED: 'FAILED',
} as const

export type PaymentRecordStatus = EnumValue<typeof PaymentRecordStatusEnum>
