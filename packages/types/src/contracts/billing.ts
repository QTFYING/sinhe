import type { BillingPackageStatus, ContractStatus, ContractType, InvoiceStatus } from '../enums'

export interface PackagePlanItem {
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

export interface PackagePlanUpsertRequest {
  name: string
  price: string
  rate: string
  strategy: string
  features: string[]
}

export interface ContractRecordItem {
  contractNo: string
  tenant: string
  type: ContractType
  expireAt: string
  status: ContractStatus
}

export interface CreateContractRequest {
  tenant: string
  contactName: string
  phone: string
  packageName: string
  annualFee: string
  rate: string
  serviceStart: string
  serviceEnd: string
}

export interface CreateContractResponse {
  contractNo: string
  signLink: string
  smsSent: boolean
}

export interface InvoiceRecordItem {
  billNo: string
  tenant: string
  amount: string
  period: string
  status: InvoiceStatus
  issuedAt?: string | null
}
