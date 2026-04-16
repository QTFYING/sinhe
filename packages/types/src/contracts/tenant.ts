import type { ListParams } from '../common'
import type {
  AuditResult,
  AuditTargetType,
  AuthSourceTag,
  FreezeAction,
  ReviewAction,
  SortOrder,
  TenantCertificationStatus,
  TenantRenewPaymentMethod,
  TenantSide,
  TenantSortField,
  TenantStatus,
  UserStatus,
} from '../enums'

export interface TenantRecordItem {
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

export interface UserRecordItem {
  id: string
  account: string
  name: string
  tenant: string
  tenantType: TenantSide
  role: string
  scope: string
  phone: string
  status: UserStatus
  loginAt: string
  requiresPasswordReset: boolean
}

export interface UserListQuery extends ListParams {
  tenant?: string
  role?: string
}

export interface UserUpsertRequest {
  name: string
  account: string
  phone: string
  tenantType: TenantSide
  tenant: string
  role: string
  scope: string
  status: UserStatus
}

export interface UserStatusUpdateRequest {
  status: UserStatus
}

export interface CreateUserPasswordResetRequest {
  password?: string
}

export interface CreateUserPasswordResetResponse {
  requiresPasswordReset: true
}

export interface AuditRecordItem {
  id: string
  actor: string
  action: string
  target: string
  targetType: AuditTargetType
  tenant: string
  time: string
  result: AuditResult
}

export interface DashboardMetricItem {
  label: string
  value: string
  helper: string
  tone: string
}

export interface PlatformTodoItem {
  title: string
  detail: string
  owner: string
  priority: string
}

export interface TenantHealthItem {
  tenant: string
  health: number
  userCoverage: string
  exception: string
  owner: string
}

export interface LoginRiskEventItem {
  account: string
  tenant: string
  event: string
  time: string
  level: string
}

export interface PlatformOverviewGrowth {
  newTenants: number
  trialToFormal: number
  churnWarning: number
  dailyTrend: number[]
}

export interface PlatformRenewalRiskItem {
  tenantName: string
  dueInDays: number
  owner: string
}

export interface PlatformOverviewResponse {
  totalFlow: number
  totalTenants: number
  newTenantsThisMonth: number
  healthScore: number
  growth: PlatformOverviewGrowth
  renewalRisks: PlatformRenewalRiskItem[]
}

export interface RoleTemplateItem {
  name: string
  side: TenantSide
  permissions: string[]
}

export interface ConsoleInfoResponse {
  productName: string
  suiteName: string
  scopeLabel: string
  operator: string
  role: string
  currentTenant: string
  source?: AuthSourceTag
}

export interface TenantListQuery extends ListParams {
  status?: TenantStatus
  sortBy?: TenantSortField
  sortOrder?: SortOrder
}

export interface CreateTenantRequest {
  name: string
  packageName: string
  admin: string
  region: string
  channel: string
  dueInDays: number
}

export interface CreateTenantAuditDecisionRequest {
  action: ReviewAction
  reviewNote?: string
  rejectReason?: string
}

export interface TenantAuditDecisionResponse {
  tenantId: string
  status: TenantStatus
  rejectReason?: string | null
  reviewedAt: string
}

export interface CreateTenantAuditBatchRequest {
  ids: string[]
  action: 'approve'
  reviewNote?: string
}

export interface CreateTenantRenewalRequest {
  packageName: string
  days: 30 | 90 | 180 | 365
  amount: number
  paymentMethod: TenantRenewPaymentMethod
}

export interface TenantRenewalResponse {
  tenantId: string
  packageName: string
  status: TenantStatus
  expireAt: string
  renewedAt: string
}

export interface PatchTenantStatusRequest {
  action: FreezeAction
  reason?: string
}

export interface TenantStatusMutationResponse {
  tenantId: string
  status: TenantStatus
  freezeReason?: string | null
  effectiveAt: string
}

export interface CreateTenantStatusChangeBatchRequest {
  ids: string[]
  reason: string
}

export interface TenantBatchActionResponse {
  successCount: number
  failedIds: string[]
}

export interface TenantMemberItem {
  id: string
  name: string
  account: string
  tenant: string
  tenantType: TenantSide
  role: string
  status: UserStatus
  scope: string
}

export interface TenantMemberListQuery {
  page?: number
  pageSize?: number
  tenantType?: TenantSide
}

export interface TenantCertificationRecordItem {
  id: string
  tenant: string
  type: string
  submitAt: string
  status: TenantCertificationStatus
  comment?: string
}

export interface TenantCertificationSubmitRequest {
  licenseUrl: string
  legalPerson: string
  legalIdCard: string
  contactPhone: string
  remark?: string
}

export interface TenantCertificationSubmitResponse {
  certId: string
  status: TenantCertificationStatus
  submittedAt: string
}

export interface TenantCertificationStatusResult {
  certId: string | null
  status: TenantCertificationStatus | null
  submittedAt: string | null
  reviewedAt: string | null
  reviewComment?: string | null
  rejectReason: string | null
}

export interface CreateTenantCertificationReviewDecisionRequest {
  action: ReviewAction
  comment?: string
}

export interface TenantCertificationReviewDecisionResponse {
  id: string
  tenant: string
  type: string
  submitAt: string
  previousStatus: TenantCertificationStatus
  status: TenantCertificationStatus
  comment?: string
  reviewedAt: string
}
