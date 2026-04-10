import type { NoticeStatus, PublishTiming, ServiceProviderStatus, TicketStatus } from '../enums'

export type { NoticeStatus, PublishTiming, ServiceProviderStatus, TicketStatus } from '../enums'

export interface AlertRule {
  id: string
  name: string
  trigger: string
  channel: string
  enabled: boolean
}

export interface AlertRulePayload {
  name: string
  trigger: string
  channel: string
}

export interface SystemConfigItem {
  group: string
  key: string
  value: string
  note: string
}

export interface ServiceConfigItem {
  id: string
  name: string
  category: string
  key: string
  provider: string
  note: string
}

export interface ServiceConfigPayload {
  name: string
  category: string
  key: string
  provider: string
  note: string
}

export interface NoticeRecord {
  id: string
  title: string
  audience: string
  status: NoticeStatus
  publishAt: string
  content?: string
  planVersion?: string
  timing?: PublishTiming
  scheduledAt?: string
  reminder?: boolean
  isDraft?: boolean
}

export interface NoticePayload {
  title: string
  content: string
  planVersion: string
  audience: string
  timing: PublishTiming
  scheduledAt?: string
  reminder: boolean
  isDraft: boolean
}

export interface TicketRecord {
  no: string
  tenant: string
  issue: string
  assignee: string
  status: TicketStatus
}

export interface ServiceProviderRecord {
  id: string
  name: string
  category: string
  status: ServiceProviderStatus
  score: string
}
