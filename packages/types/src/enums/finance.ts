import type { EnumValue } from './common'

/**
 * 租户侧对账核销状态（租户财务对账）
 */
export const FinanceReconciliationStatusEnum = {
  /** 已核销 */
  VERIFIED: 'VERIFIED',
  /** 待核销 */
  PENDING: 'PENDING',
  /** 异常 */
  EXCEPTION: 'EXCEPTION',
} as const

export type FinanceReconciliationStatus = EnumValue<typeof FinanceReconciliationStatusEnum>

/**
 * 平台对账状态（平台对账日报）
 */
export const AdminReconciliationStatusEnum = {
  /** 对账中 */
  RECONCILING: 'RECONCILING',
  /** 已核销 */
  VERIFIED: 'VERIFIED',
  /** 部分未核 */
  PARTIAL_UNVERIFIED: 'PARTIAL_UNVERIFIED',
  /** 逾期未收 */
  OVERDUE_UNPAID: 'OVERDUE_UNPAID',
} as const

export type AdminReconciliationStatus = EnumValue<typeof AdminReconciliationStatusEnum>
