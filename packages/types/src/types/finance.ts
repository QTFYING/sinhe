import type { AdminReconciliationStatus, FinanceReconciliationStatus } from '../enums'

export type { AdminReconciliationStatus, FinanceReconciliationStatus } from '../enums'

export interface FinanceSummary {
  totalReceivable: number
  totalReceived: number
  totalFee: number
  totalNet: number
  collectionRate: number
  creditOrderCount: number
  orderCount: number
}

export interface FinanceReconciliationRecord {
  orderId: string
  customer: string
  amount: number
  net: number
  fee: number
  channel: string
  paidAt: string
  status: FinanceReconciliationStatus
}

export interface AdminReconciliationSummary {
  totalReceivable: number
  totalReceived: number
  totalPending: number
  totalOverdue: number
  progressPercent: number
}

export interface AdminReconciliationDailyRecord {
  date: string
  tenant: string
  orders: number
  amount: number
  received: number
  pending: number
  status: AdminReconciliationStatus
}
