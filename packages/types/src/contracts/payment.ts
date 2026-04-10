import {
  CashVerifyStatusEnum,
  OfflinePaymentMethodEnum,
  PaymentChannelEnum,
  PaymentMethodEnum,
  PaymentOrderStatusEnum,
  PaymentRecordStatusEnum,
  type CashVerifyStatus as CashVerifyStatusType,
  type OfflinePaymentMethod as OfflinePaymentMethodType,
  type PaymentChannel as PaymentChannelType,
  type PaymentMethod as PaymentMethodType,
  type PaymentOrderStatus as PaymentOrderStatusType,
  type PaymentRecordStatus as PaymentRecordStatusType,
} from '../enums'

export const PaymentMethod = PaymentMethodEnum
export type PaymentMethod = PaymentMethodType

export const OfflinePaymentMethod = OfflinePaymentMethodEnum
export type OfflinePaymentMethod = OfflinePaymentMethodType

export const PaymentChannel = PaymentChannelEnum
export type PaymentChannel = PaymentChannelType

export const PaymentOrderStatus = PaymentOrderStatusEnum
export type PaymentOrderStatus = PaymentOrderStatusType

export const H5PayOrderStatus = PaymentOrderStatusEnum
export type H5PayOrderStatus = PaymentOrderStatusType

export const CashVerifyStatus = CashVerifyStatusEnum
export type CashVerifyStatus = CashVerifyStatusType

export const PaymentRecordStatus = PaymentRecordStatusEnum
export type PaymentRecordStatus = PaymentRecordStatusType
