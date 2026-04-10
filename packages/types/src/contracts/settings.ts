import type { TenantRole, UserSimpleStatus } from '../enums'

export interface PermissionNode {
  id: string
  label: string
  children?: PermissionNode[]
}

export interface TenantRoleAccount {
  id: string
  name: string
  description?: string
  permissions: string[]
  isSystem: boolean
  userCount: number
}

export interface TenantSettingsUser {
  id: string
  name: string
  account: string
  role: TenantRole
  phone: string
  status: UserSimpleStatus
  lastLogin: string
}

export interface CreateTenantUserRequest {
  name: string
  phone: string
  role: TenantRole
  password?: string
}

export interface UpdateTenantUserRequest {
  name?: string
  account?: string
  role?: TenantRole
  phone?: string
  status?: UserSimpleStatus
}

export interface TenantUserStatusUpdateRequest {
  status: UserSimpleStatus
}

export interface TenantGeneralSettings {
  companyName: string
  contactPerson: string
  contactPhone: string
  address: string
  licenseNo: string
  qrCodeExpiry: number
  notifySeller: boolean
  notifyOwner: boolean
  notifyFinance: boolean
  creditRemindDays: number
  dailyReportPush: boolean
}

export interface UpdateTenantGeneralSettingsRequest {
  companyName?: string
  contactPerson?: string
  contactPhone?: string
  address?: string
  licenseNo?: string
  qrCodeExpiry?: number
  notifySeller?: boolean
  notifyOwner?: boolean
  notifyFinance?: boolean
  creditRemindDays?: number
  dailyReportPush?: boolean
}

export interface PrintingConfigListItem {
  importTemplateId: string
  importTemplateName: string
  hasCustomConfig: boolean
  configVersion?: number
  updatedAt?: string
  updatedBy?: string
  remark?: string
}

export interface GetPrintingConfigListResponse {
  items: PrintingConfigListItem[]
}

export interface GetPrintingConfigDetailResponse {
  importTemplateId: string
  importTemplateName?: string
  hasCustomConfig: boolean
  configVersion?: number
  config?: Record<string, unknown>
  updatedAt?: string
  updatedBy?: string
  remark?: string
}

export interface UpdatePrintingConfigRequest {
  configVersion?: number
  config: Record<string, unknown>
  remark?: string
}

export interface UpdatePrintingConfigResponse {
  importTemplateId: string
  configVersion: number
  config: Record<string, unknown>
  updatedAt: string
  updatedBy?: string
  remark?: string
}

export interface TenantAuditLogQuery {
  page: number
  pageSize: number
  startDate?: string
  endDate?: string
  operator?: string
}

export interface AuditLogRecord {
  id: string
  action: string
  operator: string
  ip: string
  createdAt: string
}

export interface TenantNotificationRecordItem {
  id: string
  title: string
  content: string
  publishAt: string
  isRead: boolean
}
