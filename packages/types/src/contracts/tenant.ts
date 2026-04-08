export enum TenantRole {
  OWNER = 'TENANT_OWNER', // 老板
  OPERATOR = 'TENANT_OPERATOR', // 打单员
  FINANCE = 'TENANT_FINANCE', // 财务
  VIEWER = 'TENANT_VIEWER', // 访客/只读
}

export enum TenantStatus {
  ACTIVE = 'active', // 正常活跃
  ONBOARDING = 'onboarding', // 初始化/资料待审
  ATTENTION = 'attention', // 临近过期警告
  PAUSED = 'paused', // 冻结/停用
}

export enum UserStatus {
  ACTIVE = 'active', // 正常活跃
  INVITED = 'invited', // 邀请中/未激活
  LOCKED = 'locked', // 已锁定
  DISABLED = 'disabled', // 已禁用
}
