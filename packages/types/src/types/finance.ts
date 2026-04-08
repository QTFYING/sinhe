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
  status: '已核销' | '待核销' | '异常'
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
  status: '对账中' | '已核销' | '部分未核' | '逾期未收'
}
