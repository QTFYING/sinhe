export type EnumValue<T extends Record<string, string | number>> = T[keyof T]

/**
 * 列表排序方向
 */
export const SortOrderEnum = {
  /** 升序 */
  ASC: 'ASC',
  /** 降序 */
  DESC: 'DESC',
} as const

export type SortOrder = EnumValue<typeof SortOrderEnum>

/**
 * 用户所属侧（平台侧或租户侧）
 */
export const TenantSideEnum = {
  /** 平台侧 */
  PLATFORM: 'PLATFORM',
  /** 租户侧 */
  TENANT: 'TENANT',
} as const

export type TenantSide = EnumValue<typeof TenantSideEnum>

/**
 * Auth 来源标记
 */
export const AuthSourceTagEnum = {
  /** 模拟登录 */
  MOCK: 'MOCK',
  /** 外部来源（如第三方登录） */
  REMOTE: 'REMOTE',
} as const

export type AuthSourceTag = EnumValue<typeof AuthSourceTagEnum>

/**
 * 审核动作
 */
export const ReviewActionEnum = {
  /** 通过 */
  APPROVE: 'APPROVE',
  /** 驳回 */
  REJECT: 'REJECT',
} as const

export type ReviewAction = EnumValue<typeof ReviewActionEnum>

/**
 * 冻结/解冻动作
 */
export const FreezeActionEnum = {
  /** 冻结 */
  FREEZE: 'FREEZE',
  /** 解冻 */
  UNFREEZE: 'UNFREEZE',
} as const

export type FreezeAction = EnumValue<typeof FreezeActionEnum>

/**
 * 用户精简状态（用于租户内员工启停）
 */
export const UserSimpleStatusEnum = {
  /** 启用 */
  ACTIVE: 'ACTIVE',
  /** 禁用 */
  DISABLED: 'DISABLED',
} as const

export type UserSimpleStatus = EnumValue<typeof UserSimpleStatusEnum>

/**
 * 发布时机
 */
export const PublishTimingEnum = {
  /** 立即发布 */
  IMMEDIATE: 'IMMEDIATE',
  /** 定时发布 */
  SCHEDULED: 'SCHEDULED',
} as const

export type PublishTiming = EnumValue<typeof PublishTimingEnum>

/**
 * 审计目标类型
 */
export const AuditTargetTypeEnum = {
  /** 账号 */
  ACCOUNT: 'ACCOUNT',
  /** 角色 */
  ROLE: 'ROLE',
  /** 租户 */
  TENANT: 'TENANT',
} as const

export type AuditTargetType = EnumValue<typeof AuditTargetTypeEnum>

/**
 * 审计执行结果
 */
export const AuditResultEnum = {
  /** 成功 */
  SUCCESS: 'SUCCESS',
  /** 待处理 */
  PENDING: 'PENDING',
} as const

export type AuditResult = EnumValue<typeof AuditResultEnum>
