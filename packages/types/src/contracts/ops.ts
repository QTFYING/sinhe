import {
  BillingPackageStatusEnum,
  NoticeStatusEnum,
  ServiceProviderStatusEnum,
  TicketStatusEnum,
  type BillingPackageStatus as BillingPackageStatusType,
  type NoticeStatus as NoticeStatusType,
  type ServiceProviderStatus as ServiceProviderStatusType,
  type TicketStatus as TicketStatusType,
} from '../enums'

export const TicketStatus = TicketStatusEnum
export type TicketStatus = TicketStatusType

export const NoticeStatus = NoticeStatusEnum
export type NoticeStatus = NoticeStatusType

export const ServiceProviderStatus = ServiceProviderStatusEnum
export type ServiceProviderStatus = ServiceProviderStatusType

export const BillingPackageStatus = BillingPackageStatusEnum
export type BillingPackageStatus = BillingPackageStatusType

export const PackageStatus = BillingPackageStatusEnum
export type PackageStatus = BillingPackageStatusType
