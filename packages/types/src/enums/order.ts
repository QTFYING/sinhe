import type { EnumValue } from './common'

/**
 * 订单收款状态
 */
export const OrderStatusEnum = {
  /** 待收款 */
  PENDING: 'PENDING',
  /** 部分收款 */
  PARTIAL: 'PARTIAL',
  /** 已结清 */
  PAID: 'PAID',
  /** 已作废/超期 */
  EXPIRED: 'EXPIRED',
  /** 账期单 */
  CREDIT: 'CREDIT',
} as const

export type OrderStatus = EnumValue<typeof OrderStatusEnum>

/**
 * 订单付款类型
 */
export const OrderPayTypeEnum = {
  /** 现款 */
  CASH: 'CASH',
  /** 账期 */
  CREDIT: 'CREDIT',
} as const

export type OrderPayType = EnumValue<typeof OrderPayTypeEnum>

/**
 * 导入任务状态
 */
export const OrderImportJobStatusEnum = {
  /** 待处理 */
  PENDING: 'PENDING',
  /** 处理中 */
  PROCESSING: 'PROCESSING',
  /** 已完成 */
  COMPLETED: 'COMPLETED',
  /** 失败 */
  FAILED: 'FAILED',
} as const

export type OrderImportJobStatus = EnumValue<typeof OrderImportJobStatusEnum>

/**
 * 导入提交冲突策略
 */
export const OrderImportConflictPolicyEnum = {
  /** 跳过 */
  SKIP: 'SKIP',
  /** 覆盖 */
  OVERWRITE: 'OVERWRITE',
} as const

export type OrderImportConflictPolicy = EnumValue<typeof OrderImportConflictPolicyEnum>

/**
 * 映射模板字段类型
 */
export const OrderTemplateFieldTypeEnum = {
  /** 文本 */
  TEXT: 'TEXT',
  /** 数字 */
  NUMBER: 'NUMBER',
  /** 金额 */
  MONEY: 'MONEY',
  /** 日期 */
  DATE: 'DATE',
  /** 枚举 */
  ENUM: 'ENUM',
} as const

export type OrderTemplateFieldType = EnumValue<typeof OrderTemplateFieldTypeEnum>

/**
 * 账期提醒状态
 */
export const CreditOrderStatusEnum = {
  /** 正常 */
  NORMAL: 'NORMAL',
  /** 即将到期 */
  SOON: 'SOON',
  /** 今日到期 */
  TODAY: 'TODAY',
  /** 已逾期 */
  OVERDUE: 'OVERDUE',
} as const

export type CreditOrderStatus = EnumValue<typeof CreditOrderStatusEnum>
