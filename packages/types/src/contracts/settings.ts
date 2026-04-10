import type { TenantRole, UserSimpleStatus } from '../enums'

export interface PermissionNode {
  id: string
  label: string
  children?: PermissionNode[]
}

export interface TenantUserItem {
  id: string
  name: string
  account: string
  role: TenantRole
  phone: string
  status: UserSimpleStatus
  lastLogin?: string
}

export interface TenantAccountCreateRequest {
  username: string
  password: string
  role: TenantRole
  name: string
}

export interface TenantRoleConfigItem {
  id: string
  name: string
  description?: string
  permissions: string[]
  isSystem?: boolean
}

export interface TenantRoleUpsertRequest {
  name: string
  description?: string
  permissions: string[]
}

export interface TenantUserUpsertRequest {
  name: string
  phone: string
  role: TenantRole
  password?: string
}

export interface TenantUserStatusUpdateRequest {
  status: UserSimpleStatus
}

export interface TenantGeneralSettings {
  companyName: string
  contactName: string
  contactPhone: string
  address: string
  licenseNo: string
  qrExpiryDays: 30 | 60 | 90
  notifyDriver: boolean
  notifyBoss: boolean
  notifyFinance: boolean
  creditRemindDays: 1 | 3 | 5 | 7 | 14
  dailyReportPush: boolean
}

export interface TenantNotificationRecordItem {
  id: string
  title: string
  content: string
  publishAt: string
  isRead: boolean
}
