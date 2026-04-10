import type { EnumValue } from './common'

/**
 * 租户角色（预设固定角色）
 */
export const TenantRoleEnum = {
  /** 老板（拥有所有权限） */
  OWNER: 'TENANT_OWNER',
  /** 打单员（订单处理、打印发货） */
  OPERATOR: 'TENANT_OPERATOR',
  /** 财务（对账、核销） */
  FINANCE: 'TENANT_FINANCE',
  /** 访客/只读（审计与查看） */
  VIEWER: 'TENANT_VIEWER',
} as const

export type TenantRole = EnumValue<typeof TenantRoleEnum>

/**
 * 租户状态（平台视角）
 */
export const TenantStatusEnum = {
  /** 正常活跃 */
  ACTIVE: 'ACTIVE',
  /** 初始化/资料待审 */
  ONBOARDING: 'ONBOARDING',
  /** 临近过期提醒 */
  ATTENTION: 'ATTENTION',
  /** 冻结/停用 */
  PAUSED: 'PAUSED',
} as const

export type TenantStatus = EnumValue<typeof TenantStatusEnum>

/**
 * 用户完整状态机（平台账号或租户账号）
 */
export const UserStatusEnum = {
  /** 正常活跃 */
  ACTIVE: 'ACTIVE',
  /** 已邀请未激活 */
  INVITED: 'INVITED',
  /** 已锁定（通常因安全原因） */
  LOCKED: 'LOCKED',
  /** 已禁用（手动停用） */
  DISABLED: 'DISABLED',
} as const

export type UserStatus = EnumValue<typeof UserStatusEnum>

/**
 * 租户中心列表排序字段
 */
export const TenantSortFieldEnum = {
  /** 按名称排序 */
  NAME: 'NAME',
  /** 按套餐名排序 */
  PACKAGE_NAME: 'PACKAGE_NAME',
  /** 按状态排序 */
  STATUS: 'STATUS',
  /** 按距到期天数排序 */
  DUE_IN_DAYS: 'DUE_IN_DAYS',
} as const

export type TenantSortField = EnumValue<typeof TenantSortFieldEnum>

/**
 * 租户资质审核状态
 */
export const TenantCertificationStatusEnum = {
  /** 待初审 */
  PENDING_INITIAL_REVIEW: 'PENDING_INITIAL_REVIEW',
  /** 待复核 */
  PENDING_SECONDARY_REVIEW: 'PENDING_SECONDARY_REVIEW',
  /** 待确认 */
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  /** 已通过 */
  APPROVED: 'APPROVED',
  /** 已驳回 */
  REJECTED: 'REJECTED',
} as const

export type TenantCertificationStatus = EnumValue<typeof TenantCertificationStatusEnum>

/**
 * 租户续费支付方式（平台收款登记）
 */
export const TenantRenewPaymentMethodEnum = {
  /** 银行转账 */
  BANK_TRANSFER: 'BANK_TRANSFER',
  /** 微信支付 */
  WECHAT_PAY: 'WECHAT_PAY',
  /** 支付宝 */
  ALIPAY: 'ALIPAY',
  /** 线下打款 */
  OFFLINE_REMITTANCE: 'OFFLINE_REMITTANCE',
} as const

export type TenantRenewPaymentMethod = EnumValue<typeof TenantRenewPaymentMethodEnum>
