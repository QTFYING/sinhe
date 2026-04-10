import type { EnumValue } from './common'

/**
 * 平台套餐状态
 */
export const BillingPackageStatusEnum = {
  /** 生效 */
  ACTIVE: 'ACTIVE',
  /** 草稿 */
  DRAFT: 'DRAFT',
  /** 归档/下线 */
  ARCHIVED: 'ARCHIVED',
} as const

export type BillingPackageStatus = EnumValue<typeof BillingPackageStatusEnum>

/**
 * 平台合同类型（电子合同与归档合同）
 */
export const ContractTypeEnum = {
  /** 电子签 */
  ELECTRONIC_SIGNATURE: 'ELECTRONIC_SIGNATURE',
  /** 归档件 */
  ARCHIVE_COPY: 'ARCHIVE_COPY',
} as const

export type ContractType = EnumValue<typeof ContractTypeEnum>

/**
 * 平台合同状态
 */
export const ContractStatusEnum = {
  /** 履约中 */
  ACTIVE: 'ACTIVE',
  /** 待续约 */
  PENDING_RENEWAL: 'PENDING_RENEWAL',
  /** 待签署 */
  PENDING_SIGNING: 'PENDING_SIGNING',
  /** 待归档 */
  PENDING_ARCHIVE: 'PENDING_ARCHIVE',
  /** 已终止 */
  TERMINATED: 'TERMINATED',
} as const

export type ContractStatus = EnumValue<typeof ContractStatusEnum>

/**
 * 平台发票状态
 */
export const InvoiceStatusEnum = {
  /** 已开票 */
  ISSUED: 'ISSUED',
  /** 待开票 */
  PENDING_ISSUE: 'PENDING_ISSUE',
  /** 对账中 */
  RECONCILING: 'RECONCILING',
  /** 已作废 */
  VOIDED: 'VOIDED',
} as const

export type InvoiceStatus = EnumValue<typeof InvoiceStatusEnum>
