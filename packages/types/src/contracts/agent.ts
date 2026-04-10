export interface AgentItem {
  id: string
  name: string
  region: string
  merchants: number
  gmv: number
  rate: number
  commission: number
  status: 'active' | 'pending' | 'paused'
}

export interface AgentSettlementRecordItem {
  id: string
  amount: number
  period: string
  settledAt: string
}

export interface AgentSettleResponse {
  settlementId: string
  amount: number
  settledAt: string
}
