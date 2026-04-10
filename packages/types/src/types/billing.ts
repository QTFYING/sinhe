import type { BillingPackageStatus, ContractStatus, ContractType, InvoiceStatus } from '../enums'

export type { BillingPackageStatus, ContractStatus, ContractType, InvoiceStatus } from '../enums'

export interface PackagePlan {
  id: string
  name: string
  price: string
  rate: string
  tenants: number
  strategy: string
  orderTrend: string
  features: string[]
  status?: BillingPackageStatus
}

export interface PackagePlanPayload {
  name: string
  price: string
  rate: string
  strategy: string
  features: string[]
}

export interface ContractRecord {
  contractNo: string
  tenant: string
  type: ContractType
  expireAt: string
  status: ContractStatus
}

export type ContractRow = ContractRecord

export interface CreateContractPayload {
  tenant: string
  contactName: string
  phone: string
  packageName: string
  annualFee: string
  rate: string
  serviceStart: string
  serviceEnd: string
}

export interface CreateContractResult {
  contractNo: string
  signLink: string
  smsSent: boolean
}

export interface InvoiceRecord {
  billNo: string
  tenant: string
  amount: string
  period: string
  status: InvoiceStatus
  issuedAt?: string | null
}

export type InvoiceRow = InvoiceRecord
