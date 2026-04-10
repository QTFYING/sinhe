import {
  TenantCertificationStatusEnum,
  TenantRoleEnum,
  TenantStatusEnum,
  TenantRenewPaymentMethodEnum,
  TenantSortFieldEnum,
  UserStatusEnum,
  type TenantCertificationStatus as TenantCertificationStatusType,
  type TenantRole as TenantRoleType,
  type TenantRenewPaymentMethod as TenantRenewPaymentMethodType,
  type TenantSortField as TenantSortFieldType,
  type TenantStatus as TenantStatusType,
  type UserStatus as UserStatusType,
} from '../enums'

export const TenantRole = TenantRoleEnum
export type TenantRole = TenantRoleType

export const TenantStatus = TenantStatusEnum
export type TenantStatus = TenantStatusType

export const UserStatus = UserStatusEnum
export type UserStatus = UserStatusType

export const TenantSortField = TenantSortFieldEnum
export type TenantSortField = TenantSortFieldType

export const TenantCertificationStatus = TenantCertificationStatusEnum
export type TenantCertificationStatus = TenantCertificationStatusType

export const TenantRenewPaymentMethod = TenantRenewPaymentMethodEnum
export type TenantRenewPaymentMethod = TenantRenewPaymentMethodType
