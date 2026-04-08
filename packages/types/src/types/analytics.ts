export interface DailyTrend {
  day: string
  应收: number
  实收: number
}

export interface MonthlyTrend {
  month: string
  应收: number
  实收: number
}

export interface LiveFeedEntry {
  time: string
  customer: string
  amount: number
  status: string
}

export interface AnalyticsDashboard {
  todayReceivable: number
  todayReceived: number
  todayPending: number
  collectionRate: number
  pendingPrintCount: number
  creditDueSoonCount: number
  partialPaymentCount: number
  roleTitle: string
}
