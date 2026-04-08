export type AgentStatus = 'active' | 'pending' | 'paused'

export interface Agent {
  id: string
  name: string
  region: string
  merchants: number
  gmv: number
  rate: number
  commission: number
  status: AgentStatus
}

export interface AgentSettlementRecord {
  id: string
  amount: number
  period: string
  settledAt: string
}

export interface AgentSettleResult {
  settlementId: string
  amount: number
  settledAt: string
}
