import type { TenantStatus as TenantStatusContract, UserStatus as UserStatusContract } from '../contracts'
import type { ListParams } from './common'

export type TenantStatus = `${TenantStatusContract}`
export type UserStatus = `${UserStatusContract}`

export interface TenantRecord {
  id: string
  name: string
  packageName: string
  admin: string
  region: string
  merchants: number
  users: number
  channels: string[]
  monthlyFlow: number
  dueInDays: number
  lastActiveAt: string
  status: TenantStatus
  rejectReason?: string | null
  freezeReason?: string | null
}

export interface UserRecord {
  id: string
  account: string
  name: string
  tenant: string
  tenantType: '平台' | '租户'
  role: string
  scope: string
  phone: string
  status: UserStatus
  loginAt: string
  requiresPasswordReset: boolean
}

export interface UserListParams extends ListParams {
  tenant?: string
  role?: string
}

export interface UserPayload {
  name: string
  account: string
  phone: string
  tenantType: '平台' | '租户'
  tenant: string
  role: string
  scope: string
  status: UserStatus
}

export interface UserStatusPayload {
  status: UserStatus
}

export interface ResetUserPasswordPayload {
  password?: string
}

export interface ResetUserPasswordResult {
  requiresPasswordReset: true
}

export interface AuditRecord {
  id: string
  actor: string
  action: string
  target: string
  targetType: '账号' | '角色' | '租户'
  tenant: string
  time: string
  result: '成功' | '待处理'
}

export interface DashboardMetric {
  label: string
  value: string
  helper: string
  tone: string
}

export interface PlatformTodo {
  title: string
  detail: string
  owner: string
  priority: string
}

export interface TenantHealth {
  tenant: string
  health: number
  userCoverage: string
  exception: string
  owner: string
}

export interface LoginRiskEvent {
  account: string
  tenant: string
  event: string
  time: string
  level: string
}

export interface RoleTemplate {
  name: string
  side: string
  permissions: string[]
}

export interface ConsoleInfo {
  productName: string
  suiteName: string
  scopeLabel: string
  operator: string
  role: string
  currentTenant: string
}

export type TenantSortField = 'name' | 'packageName' | 'status' | 'dueInDays'
export type SortOrder = 'asc' | 'desc'

export interface TenantListParams extends ListParams {
  status?: TenantStatus
  sortBy?: TenantSortField
  sortOrder?: SortOrder
}

export interface CreateTenantPayload {
  name: string
  packageName: string
  admin: string
  region: string
  channel: string
  dueInDays: number
}

export interface TenantAuditPayload {
  action: 'approve' | 'reject'
  reviewNote?: string
  rejectReason?: string
}

export interface BatchTenantAuditPayload {
  ids: string[]
  action: 'approve'
  reviewNote?: string
}

export interface TenantRenewPayload {
  packageName: string
  days: 30 | 90 | 180 | 365
  amount: number
  paymentMethod: '银行转账' | '微信支付' | '支付宝' | '线下打款'
}

export interface TenantFreezePayload {
  action: 'freeze' | 'unfreeze'
  reason?: string
}

export interface BatchTenantFreezePayload {
  ids: string[]
  reason: string
}

export interface TenantMemberRecord {
  id: string
  name: string
  account: string
  tenant: string
  tenantType: '平台' | '租户'
  role: string
  status: UserStatus
  scope: string
}

export interface TenantMemberListParams {
  page?: number
  pageSize?: number
  tenantType?: '平台' | '租户'
}

export type TenantCertificationStatus = '待初审' | '待复核' | '待确认' | '已通过' | '已驳回'

export interface TenantCertificationRecord {
  id: string
  tenant: string
  type: string
  submitAt: string
  status: TenantCertificationStatus
  comment?: string
}

export interface ReviewTenantCertificationPayload {
  action: 'approve' | 'reject'
  comment?: string
}
