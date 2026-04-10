import type { AdminReconciliationStatus, FinanceReconciliationStatus } from '../enums'

export interface FinanceSummaryResponse {
  totalReceivable: number
  totalReceived: number
  totalFee: number
  totalNet: number
  collectionRate: number
  creditOrderCount: number
  orderCount: number
}

export interface FinanceReconciliationRecordItem {
  orderId: string
  customer: string
  amount: number
  net: number
  fee: number
  channel: string
  paidAt: string
  status: FinanceReconciliationStatus
}

export interface AdminReconciliationSummaryResponse {
  totalReceivable: number
  totalReceived: number
  totalPending: number
  totalOverdue: number
  progressPercent: number
}

export interface AdminReconciliationDailyRecordItem {
  date: string
  tenant: string
  orders: number
  amount: number
  received: number
  pending: number
  status: AdminReconciliationStatus
}
