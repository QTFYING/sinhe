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
  status: '已发布' | '草稿'
  publishAt: string
  content?: string
  planVersion?: string
  timing?: 'immediate' | 'scheduled'
  scheduledAt?: string
  reminder?: boolean
  isDraft?: boolean
}

export interface NoticePayload {
  title: string
  content: string
  planVersion: string
  audience: string
  timing: 'immediate' | 'scheduled'
  scheduledAt?: string
  reminder: boolean
  isDraft: boolean
}

export interface TicketRecord {
  no: string
  tenant: string
  issue: string
  assignee: string
  status: '处理中' | '待分派' | '已解决'
}

export interface ServiceProviderRecord {
  id: string
  name: string
  category: string
  status: '已接入' | '试运行'
  score: string
}
