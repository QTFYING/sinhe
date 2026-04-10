export interface DailyTrendItem {
  day: string
  receivableAmount: number
  receivedAmount: number
}

export interface MonthlyTrendItem {
  month: string
  receivableAmount: number
  receivedAmount: number
}

export interface LiveFeedEntryItem {
  time: string
  customer: string
  amount: number
  status: string
}

export interface AnalyticsDashboardResponse {
  todayReceivable: number
  todayReceived: number
  todayPending: number
  collectionRate: number
  pendingPrintCount: number
  creditDueSoonCount: number
  partialPaymentCount: number
  roleTitle: string
}
