import type { EnumValue } from './common'

/**
 * 平台公告状态
 */
export const NoticeStatusEnum = {
  /** 已发布 */
  PUBLISHED: 'PUBLISHED',
  /** 草稿 */
  DRAFT: 'DRAFT',
  /** 已下架 */
  OFFLINE: 'OFFLINE',
} as const

export type NoticeStatus = EnumValue<typeof NoticeStatusEnum>

/**
 * 平台工单状态
 */
export const TicketStatusEnum = {
  /** 待分派 */
  PENDING: 'PENDING',
  /** 处理中 */
  PROCESSING: 'PROCESSING',
  /** 已解决 */
  RESOLVED: 'RESOLVED',
} as const

export type TicketStatus = EnumValue<typeof TicketStatusEnum>

/**
 * 服务商接入状态
 */
export const ServiceProviderStatusEnum = {
  /** 已接入 */
  ACTIVE: 'ACTIVE',
  /** 试运行 */
  TRIAL: 'TRIAL',
} as const

export type ServiceProviderStatus = EnumValue<typeof ServiceProviderStatusEnum>
