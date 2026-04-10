import type { NoticeStatus, PublishTiming, ServiceProviderStatus, TicketStatus } from '../enums'

export interface AlertRuleItem {
  id: string
  name: string
  trigger: string
  channel: string
  enabled: boolean
}

export interface AlertRuleUpsertRequest {
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

export interface ServiceConfigUpsertRequest {
  name: string
  category: string
  key: string
  provider: string
  note: string
}

export interface NoticeRecordItem {
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

export interface NoticeUpsertRequest {
  title: string
  content: string
  planVersion: string
  audience: string
  timing: PublishTiming
  scheduledAt?: string
  reminder: boolean
  isDraft: boolean
}

export interface TicketRecordItem {
  no: string
  tenant: string
  issue: string
  assignee: string
  status: TicketStatus
}

export interface ServiceProviderRecordItem {
  id: string
  name: string
  category: string
  status: ServiceProviderStatus
  score: string
}
