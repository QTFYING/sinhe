import {
  CreditOrderStatusEnum,
  OrderImportConflictPolicyEnum,
  OrderImportJobStatusEnum,
  OrderPayTypeEnum,
  OrderStatusEnum,
  OrderTemplateFieldTypeEnum,
  type CreditOrderStatus as CreditOrderStatusType,
  type OrderImportConflictPolicy as OrderImportConflictPolicyType,
  type OrderImportJobStatus as OrderImportJobStatusType,
  type OrderPayType as OrderPayTypeType,
  type OrderStatus as OrderStatusType,
  type OrderTemplateFieldType as OrderTemplateFieldTypeType,
} from '../enums'

export const OrderStatus = OrderStatusEnum
export type OrderStatus = OrderStatusType

export const OrderPayType = OrderPayTypeEnum
export type OrderPayType = OrderPayTypeType

export const PayType = OrderPayTypeEnum
export type PayType = OrderPayTypeType

export const OrderImportJobStatus = OrderImportJobStatusEnum
export type OrderImportJobStatus = OrderImportJobStatusType

export const OrderImportConflictPolicy = OrderImportConflictPolicyEnum
export type OrderImportConflictPolicy = OrderImportConflictPolicyType

export const OrderTemplateFieldType = OrderTemplateFieldTypeEnum
export type OrderTemplateFieldType = OrderTemplateFieldTypeType

export const CreditOrderStatus = CreditOrderStatusEnum
export type CreditOrderStatus = CreditOrderStatusType
