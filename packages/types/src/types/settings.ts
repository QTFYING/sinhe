import type { TenantRole, UserSimpleStatus } from '../enums'

export type { TenantRole, UserSimpleStatus } from '../enums'

export interface PermissionNode {
  id: string
  label: string
  children?: PermissionNode[]
}

export interface TenantUser {
  id: string
  name: string
  account: string
  role: TenantRole
  phone: string
  status: UserSimpleStatus
  lastLogin?: string
}

export interface TenantAccount {
  username: string
  password: string
  role: TenantRole
  name: string
}

export type TenantRoleAccount = TenantAccount

export interface TenantRoleConfig {
  id: string
  name: string
  description?: string
  permissions: string[]
  isSystem?: boolean
}

export interface TenantRolePayload {
  name: string
  description?: string
  permissions: string[]
}

export interface TenantUserPayload {
  name: string
  phone: string
  role: TenantRole
  password?: string
}

export interface TenantUserStatusPayload {
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

export interface TenantNotificationRecord {
  id: string
  title: string
  content: string
  publishAt: string
  isRead: boolean
}
